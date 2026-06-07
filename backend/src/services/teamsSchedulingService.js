/**
 * services/teamsSchedulingService.js
 *
 * Business logic layer for Teams meeting scheduling.
 * Orchestrates between:
 *   - interviewRepository     (read/write to RDS/Postgres)
 *   - candidateRepository     (validate candidate exists)
 *   - teamsGraphService       (create/update/cancel via MS Graph)
 *   - calendarBlockingService (block panelist Outlook calendars)   ← Phase 1 addition
 *
 * Mapping contract enforced here:
 *   candidate_id → interview_id → teams_meeting_id
 *
 * This service NEVER maps by email. Always by IDs.
 *
 * Full Scheduling Flow (Phase 1):
 * 1. Validate interview exists and has no Teams meeting yet
 * 2. Build meeting payload from interview + candidate data
 * 3. Call teamsGraphService.createMeeting()          → get Teams joinUrl + meeting ID
 * 4. Call calendarBlockingService.blockPanelistCalendars() → block each panelist (best-effort)
 * 5. Save teams_meeting_id + join URL back to Interview in RDS
 * 6. Return updated interview + teams details + calendar blocking results
 *
 * Error Handling:
 * - If Graph API fails on Teams creation → throw (abort everything)
 * - If calendar blocking fails for some panelists → log, continue, return partial results
 * - If interview already has a teams_meeting_id → return 409 Conflict
 * - If interview is CANCELLED → reject scheduling
 *
 * Organizer in Application Mode:
 * - organizerUserId must be the AAD Object ID (UUID) of the organizer in app mode
 * - Falls back to GRAPH_ORGANIZER_USER_ID env var if not supplied in request
 */

'use strict';

const teamsGraphService       = require('./msGraph/teamsGraphService');
const calendarBlockingService = require('./msGraph/calendarBlockingService'); // ← Phase 1
const { interviewRepository, candidateRepository } = require('../repositories');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const { HTTP_STATUS, INTERVIEW_STATUS } = require('../constants');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a human-readable Teams meeting subject.
 * Format: "Interview: {CandidateName} — {JobRole}"
 */
const buildMeetingSubject = (candidate, interview) => {
  const name = candidate.name    || 'Candidate';
  const role = candidate.job_role || interview.organizer_email || 'Interview';
  return `Interview: ${name} — ${role}`;
};

/**
 * Calculate endDateTime given a start time and duration.
 */
const calculateEndTime = (startDateTime, durationMinutes = 60) => {
  const start = new Date(startDateTime);
  return new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString();
};

/**
 * Resolve the organizer user ID for Application mode.
 * Priority: supplied in request → GRAPH_ORGANIZER_USER_ID env var → null (will use delegated /me)
 */
const resolveOrganizerUserId = (suppliedId) => {
  if (suppliedId) return suppliedId;
  const envId = process.env.GRAPH_ORGANIZER_USER_ID;
  if (envId) {
    logger.debug(`[TeamsScheduling] Using GRAPH_ORGANIZER_USER_ID env var: ${envId}`);
    return envId;
  }
  return null;
};

// ─── Service ──────────────────────────────────────────────────────────────────

const teamsSchedulingService = {

  /**
   * scheduleInterview()
   *
   * Creates a Teams meeting for an existing interview record, then blocks
   * panelist calendars. The interview must already exist in RDS.
   *
   * @param {string} interviewId - RDS interview UUID (or legacy Mongo ID)
   * @param {Object} options     - {
   *   organizerUserId?: string,    AAD Object ID of organizer (application mode)
   *   userCacheKey?:   string,     Delegated session key (delegated mode only)
   *   panelists?:      string[],   Array of panelist email/UPN addresses to block
   *   updatedBy?:      string
   * }
   * @returns {Object} { interview, teams: { id, joinUrl, ... }, calendarBlocking: [...] }
   */
  async scheduleInterview(interviewId, options = {}) {
    const {
      userCacheKey  = null,
      panelists     = [],
      updatedBy     = 'system',
    } = options;

    // Resolve organizer user ID with env fallback
    const organizerUserId = resolveOrganizerUserId(options.organizerUserId);

    logger.info(
      `[TeamsScheduling] Scheduling interview: ${interviewId} | ` +
      `panelists: ${panelists.length} | organizer: ${organizerUserId || 'delegated /me'}`
    );

    // ── Step 1: Validate interview ─────────────────────────────────────────────
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

    // ── Step 2: Validate candidate ────────────────────────────────────────────
    const candidate = await candidateRepository.findById(
      interview.candidate_id?._id || interview.candidate_id
    );
    if (!candidate) {
      throw new AppError(
        'Cannot schedule meeting: linked candidate not found.',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // ── Step 3: Build Teams meeting payload ───────────────────────────────────
    const startDateTime = new Date(interview.scheduled_time).toISOString();
    const endDateTime   = calculateEndTime(interview.scheduled_time, interview.duration_minutes);
    const subject       = buildMeetingSubject(candidate, interview);

    // Attendees for the Teams meeting itself (candidate + panelists + interviewer)
    const attendeeEmails = [];
    if (candidate.email)                attendeeEmails.push(candidate.email);
    if (interview.interviewer_email)    attendeeEmails.push(interview.interviewer_email);
    if (panelists.length > 0)           attendeeEmails.push(...panelists);

    // Deduplicate attendees
    const uniqueAttendees = [...new Set(attendeeEmails)];

    const meetingPayload = { subject, startDateTime, endDateTime, attendees: uniqueAttendees };

    logger.info(
      `[TeamsScheduling] Creating Teams meeting | subject: "${subject}" | ` +
      `start: ${startDateTime} | attendees: ${uniqueAttendees.length}`
    );

    // ── Step 4: Create Teams meeting via Graph API ─────────────────────────────
    // If this fails, we abort the entire flow (no partial state saved)
    const graphMeeting = await teamsGraphService.createMeeting(
      meetingPayload,
      organizerUserId,
      userCacheKey
    );

    const joinUrl = graphMeeting.joinUrl || graphMeeting.joinWebUrl;
    logger.info(
      `[TeamsScheduling] Teams meeting created | graphId: ${graphMeeting.id} | joinUrl: ${joinUrl ? 'present' : 'MISSING'}`
    );

    // ── Step 4b: Block panelist calendars (best-effort, does NOT abort on failure) ──
    let calendarBlockingResults = [];
    if (panelists.length > 0) {
      logger.info(`[TeamsScheduling] Starting calendar blocking for ${panelists.length} panelist(s)...`);

      calendarBlockingResults = await calendarBlockingService.blockPanelistCalendars(
        panelists,
        {
          subject,
          startDateTime,
          endDateTime,
          joinUrl,
          organizerEmail: interview.organizer_email,
        },
        userCacheKey
      );
    } else {
      logger.info('[TeamsScheduling] No panelists supplied — calendar blocking skipped.');
    }

    // ── Step 5: Persist Teams meeting data to RDS ─────────────────────────────
    // This is the critical write. If it fails, the Teams meeting exists but is not
    // linked in our DB. The client can retry, and the service will detect the
    // existing teams_meeting_id on Graph and re-link it manually if needed.
    const teamsData = {
      teams_meeting_id: graphMeeting.id,
      meeting_join_url: joinUrl,
      status:           INTERVIEW_STATUS.SCHEDULED,
      updatedBy,
    };

    const updatedInterview = await interviewRepository.updateTeamsMeetingData(
      interviewId,
      teamsData
    );

    logger.info(
      `[TeamsScheduling] ✅ Interview ${interviewId} linked to Teams meeting: ${graphMeeting.id}`
    );

    // ── Step 6: Return unified result ─────────────────────────────────────────
    return {
      interview: updatedInterview,
      teams: {
        id:            graphMeeting.id,
        joinUrl,
        subject:       graphMeeting.subject,
        startDateTime: graphMeeting.startDateTime,
        endDateTime:   graphMeeting.endDateTime,
      },
      calendarBlocking: calendarBlockingResults,
    };
  },

  /**
   * updateScheduledInterview()
   *
   * Updates a Teams meeting tied to an existing interview.
   * Allowed updates: subject override, scheduled_time change, duration change.
   *
   * @param {string} interviewId - RDS interview UUID
   * @param {Object} updates     - { subject?, scheduled_time?, duration_minutes? }
   * @param {Object} options     - { organizerUserId?, userCacheKey?, updatedBy? }
   * @returns {Object} { interview, teams: GraphMeetingObject }
   */
  async updateScheduledInterview(interviewId, updates, options = {}) {
    const {
      userCacheKey = null,
      updatedBy    = 'system',
    } = options;

    const organizerUserId = resolveOrganizerUserId(options.organizerUserId);

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

    // Build Graph update payload (only include fields that changed)
    const graphUpdates = {};
    if (updates.subject) graphUpdates.subject = updates.subject;

    const newStart   = updates.scheduled_time
      ? new Date(updates.scheduled_time).toISOString()
      : new Date(interview.scheduled_time).toISOString();
    const newDuration = updates.duration_minutes || interview.duration_minutes;

    if (updates.scheduled_time || updates.duration_minutes) {
      graphUpdates.startDateTime = newStart;
      graphUpdates.endDateTime   = calculateEndTime(newStart, newDuration);
    }

    const graphMeeting = await teamsGraphService.updateMeeting(
      interview.teams_meeting_id,
      graphUpdates,
      organizerUserId,
      userCacheKey
    );

    const interviewUpdates = { updatedBy };
    if (updates.scheduled_time)   interviewUpdates.scheduled_time   = updates.scheduled_time;
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
   * @param {string} interviewId
   * @param {Object} options - { organizerUserId?, userCacheKey?, cancelledBy? }
   */
  async cancelScheduledInterview(interviewId, options = {}) {
    const {
      userCacheKey  = null,
      cancelledBy   = 'system',
    } = options;

    const organizerUserId = resolveOrganizerUserId(options.organizerUserId);

    logger.info(`[TeamsScheduling] Cancelling interview: ${interviewId}`);

    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);

    if (interview.status === INTERVIEW_STATUS.CANCELLED) {
      throw new AppError('Interview is already cancelled.', HTTP_STATUS.BAD_REQUEST);
    }

    if (interview.teams_meeting_id) {
      try {
        await teamsGraphService.cancelMeeting(
          interview.teams_meeting_id,
          organizerUserId,
          userCacheKey
        );
      } catch (err) {
        // 404 means the meeting was already deleted from Teams — still mark DB as cancelled
        if (err.statusCode === 404) {
          logger.warn(
            `[TeamsScheduling] Graph meeting already deleted: ${interview.teams_meeting_id}`
          );
        } else {
          throw err;
        }
      }
    }

    const updated = await interviewRepository.updateById(interviewId, {
      status:    INTERVIEW_STATUS.CANCELLED,
      updatedBy: cancelledBy,
    });

    logger.info(`[TeamsScheduling] Interview cancelled: ${interviewId}`);
    return updated;
  },

  /**
   * getScheduledInterview()
   *
   * Fetches interview details from RDS + live meeting info from Graph API.
   *
   * @param {string} interviewId
   * @param {Object} options - { organizerUserId?, userCacheKey? }
   * @returns {Object} { interview, teams: GraphMeetingObject | null }
   */
  async getScheduledInterview(interviewId, options = {}) {
    const { userCacheKey = null } = options;
    const organizerUserId = resolveOrganizerUserId(options.organizerUserId);

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
        logger.warn(
          `[TeamsScheduling] Could not fetch Graph meeting ${interview.teams_meeting_id}: ${err.message}`
        );
        teamsMeeting = {
          error: 'Meeting details unavailable from Microsoft Teams.',
          id:    interview.teams_meeting_id,
        };
      }
    }

    return { interview, teams: teamsMeeting };
  },
};

module.exports = teamsSchedulingService;