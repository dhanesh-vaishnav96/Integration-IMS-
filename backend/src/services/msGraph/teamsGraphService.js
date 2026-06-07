/**
 * services/msGraph/teamsGraphService.js
 *
 * Microsoft Graph API layer for Teams Online Meeting operations.
 * This is the ONLY file that talks to the Graph API for scheduling.
 *
 * Endpoints used:
 * ┌────────────────────────────────────────────┬────────────────────────────────────────────────┐
 * │ Operation                                  │ Graph Endpoint                                 │
 * ├────────────────────────────────────────────┼────────────────────────────────────────────────┤
 * │ createMeeting (delegated)                  │ POST /me/onlineMeetings                        │
 * │ createMeeting (application)                │ POST /users/{userId}/onlineMeetings            │
 * │ updateMeeting (delegated)                  │ PATCH /me/onlineMeetings/{meetingId}           │
 * │ updateMeeting (application)                │ PATCH /users/{userId}/onlineMeetings/{id}      │
 * │ cancelMeeting (delegated)                  │ DELETE /me/onlineMeetings/{meetingId}          │
 * │ cancelMeeting (application)                │ DELETE /users/{userId}/onlineMeetings/{id}     │
 * │ getMeeting (delegated)                     │ GET /me/onlineMeetings/{meetingId}             │
 * │ getMeeting (application)                   │ GET /users/{userId}/onlineMeetings/{id}        │
 * └────────────────────────────────────────────┴────────────────────────────────────────────────┘
 *
 * Graph Meeting Object Key Fields (returned by API):
 *   id              → teams_meeting_id (store this in Interview)
 *   joinUrl         → meeting_join_url
 *   joinWebUrl      → alias for joinUrl in some tenants
 *   subject         → meeting title
 *   startDateTime   → ISO datetime
 *   endDateTime     → ISO datetime
 *   organizer       → { identity: { user: { id, displayName } } }
 *   participants    → { attendees: [...] }
 *   videoTeleconferenceId → used for call record lookup
 */
const { getGraphClient } = require('./graphClientFactory');
const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const config = require('../../config/env');
const { HTTP_STATUS } = require('../../constants');

/**
 * Resolve the base Graph endpoint for online meetings.
 * In delegated mode: /me/onlineMeetings
 * In application mode: /users/{organizerUserId}/onlineMeetings
 *
 * @param {string|null} organizerUserId - Required for application mode
 * @returns {string} Graph API base path
 */
const resolveMeetingBasePath = (organizerUserId = null) => {
  const mode = config.msGraph.authMode;
  if (mode === 'application') {
    if (!organizerUserId) {
      throw new AppError(
        'organizerUserId is required when AUTH_MODE=application. Provide the AAD User ID of the meeting organizer.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    return `/users/${organizerUserId}/onlineMeetings`;
  }
  return '/me/onlineMeetings';
};

/**
 * Map Microsoft Graph API errors to our AppError format.
 */
const mapGraphError = (err, context) => {
  const statusCode = err.statusCode || err.status || 500;
  const code = err.body?.error?.code || 'Unknown';
  const message = err.body?.error?.message || err.message || 'Graph API error';
  logger.error(`[TeamsGraphService] ${context} | code: ${code} | ${message}`);

  if (statusCode === 401) return new AppError(`Teams API: Unauthorized. Re-authenticate via /ms/auth/login. (${code})`, HTTP_STATUS.UNAUTHORIZED);
  if (statusCode === 403) return new AppError(`Teams API: Forbidden. Check Azure API permissions. (${code})`, HTTP_STATUS.FORBIDDEN);
  if (statusCode === 404) return new AppError(`Teams API: Meeting not found. Verify the meeting ID. (${code})`, HTTP_STATUS.NOT_FOUND);
  if (statusCode === 409) return new AppError(`Teams API: Conflict. This meeting may already exist. (${code})`, HTTP_STATUS.CONFLICT);
  if (statusCode === 429) return new AppError('Teams API: Rate limited. Retry after a moment.', HTTP_STATUS.TOO_MANY_REQUESTS);
  return new AppError(`Teams API Error [${statusCode}]: ${message}`, statusCode);
};

const teamsGraphService = {
  /**
   * createMeeting()
   *
   * Creates a Microsoft Teams online meeting via Graph API.
   * Returns the raw Graph meeting object containing:
   *   - id (teams_meeting_id)
   *   - joinUrl (meeting_join_url)
   *   - subject, startDateTime, endDateTime
   *
   * @param {Object} meetingPayload - { subject, startDateTime, endDateTime, attendees? }
   * @param {string|null} organizerUserId - AAD User ID (application mode only)
   * @param {string|null} userCacheKey - Session key (delegated mode only)
   * @returns {Object} Graph API onlineMeeting object
   */
  async createMeeting(meetingPayload, organizerUserId = null, userCacheKey = null) {
    const start = Date.now();
    const basePath = resolveMeetingBasePath(organizerUserId);
    logger.info(`[TeamsGraphService] Creating meeting: "${meetingPayload.subject}" | endpoint: ${basePath}`);

    try {
      const client = getGraphClient(userCacheKey);

      // Build Graph API meeting body
      const body = {
        subject: meetingPayload.subject,
        startDateTime: meetingPayload.startDateTime,
        endDateTime: meetingPayload.endDateTime,
      };

      // Add attendees if provided
      if (meetingPayload.attendees && meetingPayload.attendees.length > 0) {
        body.participants = {
          attendees: meetingPayload.attendees.map((email) => ({
            upn: email,
            role: 'attendee',
            identity: { user: { additionalData: { upn: email } } },
          })),
        };
      }

      const meeting = await client.api(basePath).post(body);

      logger.info(
        `[TeamsGraphService] Meeting created in ${Date.now() - start}ms | id: ${meeting.id}`
      );
      return meeting;
    } catch (err) {
      throw mapGraphError(err, `createMeeting("${meetingPayload.subject}")`);
    }
  },

  /**
   * updateMeeting()
   *
   * Updates an existing Teams meeting subject, time, or duration.
   * Uses PATCH — only fields provided are updated.
   *
   * @param {string} teamsMeetingId - The Graph meeting ID (from Interview.teams_meeting_id)
   * @param {Object} updates - Fields to update: { subject?, startDateTime?, endDateTime? }
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   * @returns {Object} Updated Graph meeting object
   */
  async updateMeeting(teamsMeetingId, updates, organizerUserId = null, userCacheKey = null) {
    const basePath = resolveMeetingBasePath(organizerUserId);
    const endpoint = `${basePath}/${teamsMeetingId}`;
    logger.info(`[TeamsGraphService] Updating meeting: ${teamsMeetingId}`);

    try {
      const client = getGraphClient(userCacheKey);
      const patch = {};
      if (updates.subject) patch.subject = updates.subject;
      if (updates.startDateTime) patch.startDateTime = updates.startDateTime;
      if (updates.endDateTime) patch.endDateTime = updates.endDateTime;

      // Graph PATCH for onlineMeetings returns 200 with updated meeting
      const meeting = await client.api(endpoint).patch(patch);
      logger.info(`[TeamsGraphService] Meeting updated: ${teamsMeetingId}`);
      return meeting;
    } catch (err) {
      throw mapGraphError(err, `updateMeeting(${teamsMeetingId})`);
    }
  },

  /**
   * cancelMeeting()
   *
   * Deletes a Teams online meeting via Graph API.
   * Note: This removes the meeting from Graph, but does NOT send cancellation
   * emails to attendees automatically. Use a calendar event for that (Phase 5).
   *
   * @param {string} teamsMeetingId
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   */
  async cancelMeeting(teamsMeetingId, organizerUserId = null, userCacheKey = null) {
    const basePath = resolveMeetingBasePath(organizerUserId);
    const endpoint = `${basePath}/${teamsMeetingId}`;
    logger.info(`[TeamsGraphService] Cancelling meeting: ${teamsMeetingId}`);

    try {
      const client = getGraphClient(userCacheKey);
      await client.api(endpoint).delete();
      logger.info(`[TeamsGraphService] Meeting cancelled: ${teamsMeetingId}`);
    } catch (err) {
      throw mapGraphError(err, `cancelMeeting(${teamsMeetingId})`);
    }
  },

  /**
   * getMeeting()
   *
   * Fetches a Teams meeting by its Graph meeting ID.
   *
   * @param {string} teamsMeetingId
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   * @returns {Object} Graph meeting object
   */
  async getMeeting(teamsMeetingId, organizerUserId = null, userCacheKey = null) {
    const basePath = resolveMeetingBasePath(organizerUserId);
    const endpoint = `${basePath}/${teamsMeetingId}`;
    logger.info(`[TeamsGraphService] Fetching meeting: ${teamsMeetingId}`);

    try {
      const client = getGraphClient(userCacheKey);
      const meeting = await client.api(endpoint).get();
      return meeting;
    } catch (err) {
      throw mapGraphError(err, `getMeeting(${teamsMeetingId})`);
    }
  },
};

module.exports = teamsGraphService;
