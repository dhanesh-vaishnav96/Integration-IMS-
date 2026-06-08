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
const processingService       = require('./processingService');
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

    // Deduplicate attendees, excluding organizer
    const uniqueAttendees = [...new Set(attendeeEmails.filter(email => 
      email !== options.organizerUserId && 
      email !== process.env.TEAMS_ORGANIZER_EMAIL && 
      email !== process.env.TEAMS_ORGANIZER_OBJECT_ID &&
      email
    ))];

    const meetingPayload = { subject, startDateTime, endDateTime, attendees: uniqueAttendees };

    logger.info(
      `[TeamsScheduling] Creating Teams meeting | subject: "${subject}" | ` +
      `start: ${startDateTime} | attendees: ${uniqueAttendees.length}`
    );

    // ── Step 4: Create Calendar Event with auto-generated Teams Meeting ───────
    // We bypass /onlineMeetings due to Application Access Policy limitations
    // and rely on Exchange Online to auto-generate the Teams link.
    const eventPayload = {
      subject,
      start: { dateTime: startDateTime, timeZone: 'UTC' },
      end: { dateTime: endDateTime, timeZone: 'UTC' },
      location: { displayName: 'Microsoft Teams' },
      attendees: uniqueAttendees.map(email => ({
        emailAddress: { address: email },
        type: 'required'
      })),
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      showAs: 'busy'
    };

    let graphMeeting = {};
    let joinUrl = null;
    let eventId = null;

    try {
      logger.info(`[TeamsScheduling] Requesting auto-generated Teams meeting via Calendar Event...`);
      const client = require('./msGraph/graphClientFactory').getGraphClient(userCacheKey);
      
      const targetUser = process.env.TEAMS_ORGANIZER_OBJECT_ID;
      if (!targetUser) throw new Error("TEAMS_ORGANIZER_OBJECT_ID is not configured. Server startup validation failed.");

      const endpoint = userCacheKey ? '/me/calendar/events' : `/users/${targetUser}/calendar/events`;
      
      const event = await client.api(endpoint).post(eventPayload);
      eventId = event.id;
      
      if (event.onlineMeeting && event.onlineMeeting.joinUrl) {
        joinUrl = event.onlineMeeting.joinUrl;
        graphMeeting = { id: event.onlineMeeting.id || eventId, ...event.onlineMeeting };

        // ── STEP 4B: Inject Clean HTML Description ──
        logger.info(`[TeamsScheduling] Patching custom body into Event ID: ${eventId}`);
        
        const candidateName = candidate.name || 'Candidate';
        const panelistName = uniqueAttendees.filter(a => a !== candidate.email).join(', ') || 'Panelist';
        const dateStr = new Date(startDateTime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = `${new Date(startDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${new Date(endDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        
        const customHtml = `
          <h2>Interview: ${interview.title || interview.round || 'Technical Interview'}</h2>
          <p><strong>Candidate:</strong> ${candidateName}</p>
          <p><strong>Panelist:</strong> ${panelistName}</p>
          <p><strong>Date:</strong> ${dateStr}</p>
          <p><strong>Time:</strong> ${timeStr}</p>
          <p>Please join using the Teams Join button below.</p>
          <p>
            <a href="${joinUrl}" style="display:inline-block;padding:10px 20px;background-color:#5B5FC7;color:white;text-decoration:none;border-radius:5px;font-weight:bold;margin-top:10px;">
              Join Meeting
            </a>
          </p>
        `;

        await client.api(`${endpoint}/${eventId}`).patch({
          body: {
            contentType: 'html',
            content: customHtml
          }
        });

        logger.info(`[GRAPH]
Organizer: ${process.env.TEAMS_ORGANIZER_EMAIL}
Organizer Object ID: ${process.env.TEAMS_ORGANIZER_OBJECT_ID}
Endpoint: ${endpoint}
Attendees: ${uniqueAttendees.join(', ')}
Event ID: ${eventId}
Online Meeting ID: ${graphMeeting.id}
JoinUrl: ${joinUrl}
Status: 201 Created
Meeting Created Successfully`);
      } else {
        logger.warn(`[TeamsScheduling] ⚠️ Event created, but Exchange did not generate a Teams link.`);
      }

    } catch (err) {
      logger.error(`[GRAPH] Calendar Teams Meeting generation failed: ${err.message}`);
      throw new AppError(`Graph Calendar Meeting Creation Failed: ${err.message}`, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // ── Step 5: Persist Teams meeting data to RDS ─────────────────────────────
    const teamsData = {
      teams_meeting_id:         graphMeeting.id || eventId,
      online_meeting_id:        graphMeeting.id,
      meeting_join_url:         joinUrl,
      graph_event_id:           eventId,
      status:                   INTERVIEW_STATUS.SCHEDULED,
      organizer_email:          process.env.TEAMS_ORGANIZER_EMAIL,
      organizer_object_id:      process.env.TEAMS_ORGANIZER_OBJECT_ID,
      graph_meeting_created_at: new Date().toISOString(),
      updatedBy,
    };

    const updatedInterview = await interviewRepository.updateTeamsMeetingData(
      interviewId,
      teamsData
    );

    logger.info(
      `[TeamsScheduling] ✅ Interview ${interviewId} linked to auto-generated Teams meeting: ${teamsData.teams_meeting_id}`
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
      }
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

    if (interview.graph_event_id) {
      try {
        const client = require('./msGraph/graphClientFactory').getGraphClient(userCacheKey);
        const targetUser = organizerUserId || interview.organizer_email;
        const endpoint = userCacheKey ? `/me/calendar/events/${interview.graph_event_id}` : `/users/${targetUser}/calendar/events/${interview.graph_event_id}`;
        
        await client.api(endpoint).delete();
        logger.info(`[TeamsScheduling] Calendar event deleted: ${interview.graph_event_id}`);
      } catch (err) {
        if (err.statusCode === 404) {
          logger.warn(`[TeamsScheduling] Graph event already deleted: ${interview.graph_event_id}`);
        } else {
          logger.error(`[TeamsScheduling] Failed to delete calendar event: ${err.message}`);
          // Don't throw, let DB update proceed so the interview is marked cancelled locally
        }
      }
    } else if (interview.teams_meeting_id) {
      try {
        await teamsGraphService.cancelMeeting(
          interview.teams_meeting_id,
          organizerUserId,
          userCacheKey
        );
      } catch (err) {
        if (err.statusCode === 404) {
          logger.warn(`[TeamsScheduling] Graph meeting already deleted: ${interview.teams_meeting_id}`);
        } else {
          // Don't throw, let DB update proceed
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

  /**
   * syncMeetingArtifacts()
   *
   * Triggers the background artifact processing (recording/transcript download to S3).
   *
   * @param {string} interviewId
   * @param {Object} options
   */
  async syncMeetingArtifacts(interviewId, options = {}) {
    const { userCacheKey = null } = options;
    // Fall back to env or email
    const organizerUserId = resolveOrganizerUserId(options.organizerUserId);

    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);
    if (!interview.teams_meeting_id) {
      throw new AppError('Interview does not have an associated Teams meeting to sync.', HTTP_STATUS.BAD_REQUEST);
    }

    const candidateId = interview.candidate_id?._id?.toString() || interview.candidate_id?.toString();

    const mapping = {
      interviewId: interview._id.toString(),
      candidateId: candidateId,
      meetingId: interview.teams_meeting_id
    };

    logger.info(`[TeamsScheduling] Triggering manual artifact sync for interview ${interviewId}`);

    // Fire and forget: the processArtifacts method has its own robust p-retry logic
    processingService.processArtifacts('manual-sync', mapping, organizerUserId, userCacheKey)
      .then(() => logger.info(`[TeamsScheduling] Manual artifact sync finished successfully for ${interviewId}`))
      .catch(err => logger.error(`[TeamsScheduling] Manual artifact sync failed for ${interviewId}: ${err.message}`));

    return { status: 'QUEUED', interviewId, message: 'Artifact synchronization has been scheduled in the background.' };
  },
};

module.exports = teamsSchedulingService;