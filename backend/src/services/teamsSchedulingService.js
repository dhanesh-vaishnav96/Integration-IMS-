/**
 * services/teamsSchedulingService.js
 *
 * Business logic layer for Teams meeting scheduling.
 * Orchestrates between:
 *   - interviewRepository   (read/write to MongoDB)
 *   - candidateRepository   (validate candidate exists)
 *   - teamsGraphService     (create/update/cancel via MS Graph)
 *
 * Mapping contract enforced here:
 *   candidate_id → interview_id → teams_meeting_id
 *
 * This service NEVER maps by email. Always by IDs.
 *
 * Scheduling flow:
 * 1. Validate interview exists and has no Teams meeting yet
 * 2. Build meeting payload from interview + candidate data
 * 3. Call teamsGraphService.createMeeting()
 * 4. Save teams_meeting_id + join URL back to Interview
 * 5. Return the updated interview
 *
 * Error Handling:
 * - If Graph API fails AFTER we stored partial data → log warning, allow retry
 * - If interview already has a teams_meeting_id → return 409 Conflict
 * - If interview is CANCELLED → reject scheduling
 */
const teamsGraphService = require('./msGraph/teamsGraphService');
const { interviewRepository, candidateRepository } = require('../repositories');


const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const { HTTP_STATUS, INTERVIEW_STATUS } = require('../constants');

/**
 * Build a human-readable Teams meeting subject.
 * Format: "Interview: {CandidateName} — {JobRole}"
 */
const buildMeetingSubject = (candidate, interview) => {
  const name = candidate.name || 'Candidate';
  const role = candidate.job_role || interview.organizer_email;
  return `Interview: ${name} — ${role}`;
};

/**
 * Calculate endDateTime given a start time and duration.
 * @param {Date|string} startDateTime
 * @param {number} durationMinutes
 * @returns {string} ISO 8601 endDateTime string
 */
const calculateEndTime = (startDateTime, durationMinutes = 60) => {
  const start = new Date(startDateTime);
  return new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString();
};

const teamsSchedulingService = {
  /**
   * scheduleInterview()
   *
   * Creates a Teams meeting for an existing interview record.
   * The interview must already exist (created in Phase 2 via POST /api/v1/interviews).
   *
   * @param {string} interviewId - MongoDB interview _id
   * @param {Object} options - { organizerUserId?, userCacheKey?, updatedBy? }
   * @returns {Object} Updated interview with teams_meeting_id and join URL
   */
  async scheduleInterview(interviewId, options = {}) {
    const { organizerUserId = null, userCacheKey = null, updatedBy = 'system' } = options;
    const log = logger;

    log.info(`[TeamsScheduling] Scheduling interview: ${interviewId}`);

    // ── Step 1: Validate interview exists ──────────────────────────
    const interview = await interviewRepository.findById(interviewId);
    if (!interview) {
      throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (interview.status === INTERVIEW_STATUS.CANCELLED) {
      throw new AppError(
        'Cannot schedule a Teams meeting for a cancelled interview.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (interview.teams_meeting_id) {
      throw new AppError(
        `This interview already has a Teams meeting (ID: ${interview.teams_meeting_id}). ` +
          'Use PUT /api/v1/teams/:id to update it.',
        HTTP_STATUS.CONFLICT
      );
    }

    // ── Step 2: Validate and load candidate ─────────────────────────
    const candidate = await candidateRepository.findById(interview.candidate_id._id || interview.candidate_id);
    if (!candidate) {
      throw new AppError(
        'Cannot schedule meeting: linked candidate not found.',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // ── Step 3: Build meeting payload ───────────────────────────────
    const startDateTime = new Date(interview.scheduled_time).toISOString();
    const endDateTime = calculateEndTime(interview.scheduled_time, interview.duration_minutes);
    const subject = buildMeetingSubject(candidate, interview);

    const attendees = [];
    if (interview.interviewer_email) attendees.push(interview.interviewer_email);

    const meetingPayload = { subject, startDateTime, endDateTime, attendees };

    log.info(
      `[TeamsScheduling] Creating Teams meeting | subject: "${subject}" | start: ${startDateTime}`
    );

    // ── Step 4: Create meeting via Graph API ────────────────────────
    const graphMeeting = await teamsGraphService.createMeeting(
      meetingPayload,
      organizerUserId,
      userCacheKey
    );

    // ── Step 5: Save meeting data back to Interview (critical step) ─
    const teamsData = {
      teams_meeting_id: graphMeeting.id,
      meeting_join_url: graphMeeting.joinUrl || graphMeeting.joinWebUrl,
      status: INTERVIEW_STATUS.SCHEDULED,
      updatedBy,
    };

    const updatedInterview = await interviewRepository.updateTeamsMeetingData(
      interviewId,
      teamsData
    );

    log.info(
      `[TeamsScheduling] ✅ Interview ${interviewId} linked to Teams meeting: ${graphMeeting.id}`
    );

    return {
      interview: updatedInterview,
      teams: {
        id: graphMeeting.id,
        joinUrl: graphMeeting.joinUrl || graphMeeting.joinWebUrl,
        subject: graphMeeting.subject,
        startDateTime: graphMeeting.startDateTime,
        endDateTime: graphMeeting.endDateTime,
      },
    };
  },

  /**
   * updateScheduledInterview()
   *
   * Updates a Teams meeting tied to an existing interview.
   * Allowed updates: subject override, scheduled_time change, duration change.
   *
   * @param {string} interviewId - MongoDB interview _id
   * @param {Object} updates - { subject?, scheduled_time?, duration_minutes? }
   * @param {Object} options - { organizerUserId?, userCacheKey?, updatedBy? }
   * @returns {Object} Updated interview + Graph meeting object
   */
  async updateScheduledInterview(interviewId, updates, options = {}) {
    const { organizerUserId = null, userCacheKey = null, updatedBy = 'system' } = options;

    logger.info(`[TeamsScheduling] Updating interview: ${interviewId}`);

    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);

    if (!interview.teams_meeting_id) {
      throw new AppError(
        'This interview does not have a Teams meeting yet. Use POST /api/v1/teams/schedule first.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (interview.status === INTERVIEW_STATUS.CANCELLED) {
      throw new AppError('Cannot update a cancelled interview.', HTTP_STATUS.BAD_REQUEST);
    }

    // Build Graph update payload
    const graphUpdates = {};
    if (updates.subject) graphUpdates.subject = updates.subject;

    const newStart = updates.scheduled_time
      ? new Date(updates.scheduled_time).toISOString()
      : new Date(interview.scheduled_time).toISOString();
    const newDuration = updates.duration_minutes || interview.duration_minutes;

    if (updates.scheduled_time || updates.duration_minutes) {
      graphUpdates.startDateTime = newStart;
      graphUpdates.endDateTime = calculateEndTime(newStart, newDuration);
    }

    // Update on Graph API
    const graphMeeting = await teamsGraphService.updateMeeting(
      interview.teams_meeting_id,
      graphUpdates,
      organizerUserId,
      userCacheKey
    );

    // Update Interview record in MongoDB with new schedule data
    const interviewUpdates = { updatedBy };
    if (updates.scheduled_time) interviewUpdates.scheduled_time = updates.scheduled_time;
    if (updates.duration_minutes) interviewUpdates.duration_minutes = updates.duration_minutes;

    const updatedInterview = await interviewRepository.updateById(interviewId, interviewUpdates);

    logger.info(`[TeamsScheduling] Interview updated: ${interviewId}`);
    return { interview: updatedInterview, teams: graphMeeting };
  },

  /**
   * cancelScheduledInterview()
   *
   * Cancels a Teams meeting and marks the interview as CANCELLED.
   *
   * @param {string} interviewId - MongoDB interview _id
   * @param {Object} options - { organizerUserId?, userCacheKey?, cancelledBy? }
   */
  async cancelScheduledInterview(interviewId, options = {}) {
    const { organizerUserId = null, userCacheKey = null, cancelledBy = 'system' } = options;

    logger.info(`[TeamsScheduling] Cancelling interview: ${interviewId}`);

    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);

    if (interview.status === INTERVIEW_STATUS.CANCELLED) {
      throw new AppError('Interview is already cancelled.', HTTP_STATUS.BAD_REQUEST);
    }

    // Cancel on Graph API (only if meeting was created)
    if (interview.teams_meeting_id) {
      try {
        await teamsGraphService.cancelMeeting(
          interview.teams_meeting_id,
          organizerUserId,
          userCacheKey
        );
      } catch (err) {
        // If Graph returns 404, the meeting is already gone — still mark as cancelled in DB
        if (err.statusCode === 404) {
          logger.warn(`[TeamsScheduling] Graph meeting already deleted: ${interview.teams_meeting_id}`);
        } else {
          throw err;
        }
      }
    }

    // Mark interview as CANCELLED in MongoDB
    const updated = await interviewRepository.updateById(interviewId, {
      status: INTERVIEW_STATUS.CANCELLED,
      updatedBy: cancelledBy,
    });

    logger.info(`[TeamsScheduling] Interview cancelled: ${interviewId}`);
    return updated;
  },

  /**
   * getScheduledInterview()
   *
   * Fetches interview details from MongoDB + live meeting info from Graph API.
   * Combines both for a complete view.
   *
   * @param {string} interviewId - MongoDB interview _id
   * @param {Object} options - { organizerUserId?, userCacheKey? }
   * @returns {Object} { interview, teams: GraphMeetingObject | null }
   */
  async getScheduledInterview(interviewId, options = {}) {
    const { organizerUserId = null, userCacheKey = null } = options;

    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);

    let teamsMeeting = null;
    if (interview.teams_meeting_id) {
      try {
        teamsMeeting = await teamsGraphService.getMeeting(
          interview.teams_meeting_id,
          organizerUserId,
          userCacheKey
        );
      } catch (err) {
        // Meeting may have been deleted from Teams side
        logger.warn(
          `[TeamsScheduling] Could not fetch Graph meeting ${interview.teams_meeting_id}: ${err.message}`
        );
        teamsMeeting = { error: 'Meeting details unavailable from Microsoft Teams.', id: interview.teams_meeting_id };
      }
    }

    return { interview, teams: teamsMeeting };
  },
};

module.exports = teamsSchedulingService;