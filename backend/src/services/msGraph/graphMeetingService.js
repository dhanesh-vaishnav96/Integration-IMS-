/**
 * services/msGraph/graphMeetingService.js
 *
 * Microsoft Graph API service for connectivity testing and meeting lookups.
 * Phase 3A scope only — NO recording or transcript logic here.
 *
 * Methods implemented:
 * ┌───────────────────────┬──────────────────────────────────────────────────┐
 * │ Method                │ Graph API Endpoint                               │
 * ├───────────────────────┼──────────────────────────────────────────────────┤
 * │ verifyConnection()    │ GET /me (delegated) or /organization (app)       │
 * │ getCurrentUser()      │ GET /me                                          │
 * │ getUserProfile()      │ GET /users/:userId                               │
 * │ listUsers()           │ GET /users?$top=N                                │
 * │ getMeetingById()      │ GET /me/onlineMeetings/:meetingId                │
 * └───────────────────────┴──────────────────────────────────────────────────┘
 *
 * Error Handling:
 * All Graph API errors are caught and mapped to AppError with appropriate
 * HTTP status codes. Raw Graph error codes (e.g., "Forbidden", "NotFound")
 * are translated to clear developer messages.
 */
const { getGraphClient } = require('./graphClientFactory');
const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const config = require('../../config/env');
const { HTTP_STATUS } = require('../../constants');

/**
 * Maps Microsoft Graph error responses to our AppError format.
 * @param {Error} err - Graph SDK or axios error
 * @param {string} context - Operation context for logging
 */
const mapGraphError = (err, context) => {
  let statusCode = err.statusCode || err.status || 500;
  if (statusCode < 100 || statusCode > 599) statusCode = 500;
  const code = err.body?.error?.code || err.code || 'Unknown';
  const message = err.body?.error?.message || err.message || 'Graph API error';

  logger.error(`[GraphMeetingService] ${context} failed | code: ${code} | msg: ${message}`);

  switch (statusCode) {
    case 401:
      return new AppError(
        `Graph API: Unauthorized. Token may be expired or missing consent. (${code})`,
        HTTP_STATUS.UNAUTHORIZED
      );
    case 403:
      return new AppError(
        `Graph API: Forbidden. The application lacks the required permissions. Check Azure AD → API Permissions. (${code})`,
        HTTP_STATUS.FORBIDDEN
      );
    case 404:
      return new AppError(
        `Graph API: Resource not found. Check the meeting ID or user ID. (${code})`,
        HTTP_STATUS.NOT_FOUND
      );
    case 429:
      return new AppError(
        `Graph API: Rate limited. Too many requests. Retry after the Retry-After header value.`,
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    default:
      return new AppError(`Graph API Error [${statusCode}]: ${message}`, statusCode);
  }
};

const graphMeetingService = {
  /**
   * verifyConnection()
   *
   * Tests that authentication is working end-to-end.
   * In delegated mode: calls /me (requires signed-in user)
   * In application mode: calls /organization (does not require a user)
   *
   * This is the success criterion for Phase 3A.
   *
   * @param {string} [userCacheKey] - Delegated mode user session key
   * @returns {Object} Connection verification result
   */
  async verifyConnection(userCacheKey = null) {
    const start = Date.now();
    const mode = config.msGraph.authMode;
    logger.info(`[GraphMeetingService] Verifying Graph connection | mode: ${mode}`);

    try {
      const client = getGraphClient(userCacheKey);
      let result;

      if (mode === 'delegated') {
        result = await client.api('/me').select('id,displayName,mail,userPrincipalName').get();
      } else {
        // Application mode: /me is not available, use /organization instead
        result = await client.api('/organization').select('id,displayName').get();
      }

      const duration = Date.now() - start;
      logger.info(`[GraphMeetingService] Connection verified in ${duration}ms`);

      return {
        connected: true,
        authMode: mode,
        graphApiVersion: 'v1.0',
        responseTimeMs: duration,
        data: result,
      };
    } catch (err) {
      throw mapGraphError(err, 'verifyConnection');
    }
  },

  /**
   * getCurrentUser()
   *
   * Fetches the profile of the currently authenticated user.
   * Only works in DELEGATED mode.
   *
   * @param {string} userCacheKey - Session key from /ms/auth/callback
   * @returns {Object} Microsoft Graph user profile
   */
  async getCurrentUser(userCacheKey = null) {
    const mode = config.msGraph.authMode;

    if (mode === 'application') {
      throw new AppError(
        '/me endpoint is not available in application auth mode. No signed-in user context exists.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    logger.info('[GraphMeetingService] Fetching current user (/me)');

    try {
      const client = getGraphClient(userCacheKey);
      const user = await client
        .api('/me')
        .select('id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone')
        .get();

      logger.debug(`[GraphMeetingService] Current user: ${user.displayName} (${user.mail})`);
      return user;
    } catch (err) {
      throw mapGraphError(err, 'getCurrentUser');
    }
  },

  /**
   * getUserProfile()
   *
   * Fetch a specific user by their Microsoft 365 user ID or UPN (email).
   * Works in both modes. Application mode needs User.Read.All.
   *
   * @param {string} userId - AAD Object ID or user principal name (email)
   * @param {string} [userCacheKey] - Session key (delegated mode)
   * @returns {Object} User profile
   */
  async getUserProfile(userId, userCacheKey = null) {
    logger.info(`[GraphMeetingService] Fetching user profile: ${userId}`);

    try {
      const client = getGraphClient(userCacheKey);
      const user = await client
        .api(`/users/${userId}`)
        .select('id,displayName,mail,userPrincipalName,jobTitle,department')
        .get();

      return user;
    } catch (err) {
      throw mapGraphError(err, `getUserProfile(${userId})`);
    }
  },

  /**
   * listUsers()
   *
   * List users in the tenant directory.
   * Application mode: requires User.Read.All (admin consent needed).
   * Delegated mode: returns users visible to the logged-in user.
   *
   * @param {number} [limit=10] - Number of users to return (max 999)
   * @param {string} [userCacheKey] - Session key (delegated mode)
   * @returns {Array} List of user objects
   */
  async listUsers(limit = 10, userCacheKey = null) {
    const top = Math.min(Math.max(1, limit), 100); // Clamp 1-100
    logger.info(`[GraphMeetingService] Listing users | top: ${top}`);

    try {
      const client = getGraphClient(userCacheKey);
      const response = await client
        .api('/users')
        .select('id,displayName,mail,userPrincipalName,jobTitle')
        .top(top)
        .orderby('displayName asc')
        .get();

      logger.debug(`[GraphMeetingService] Listed ${response.value?.length} users`);
      return response.value || [];
    } catch (err) {
      throw mapGraphError(err, 'listUsers');
    }
  },

  /**
   * getMeetingById()
   *
   * Fetch a Teams online meeting by its meeting ID.
   *
   * IMPORTANT — Microsoft Graph meeting ID note:
   * - The meeting ID format from Graph API looks like:
   *   MSowNjJiOTM1ZC00Yzc1...== (base64-encoded)
   * - This is NOT the same as the joinUrl's "meetup-join" segment.
   * - Teams webhooks and CallRecords API use a different "call ID".
   *
   * Phase 3B will handle the mapping between these IDs.
   *
   * In delegated mode: GET /me/onlineMeetings/:meetingId
   * In application mode: GET /users/:userId/onlineMeetings/:meetingId
   *   (requires knowing which user organized the meeting)
   *
   * @param {string} meetingId - The Graph API online meeting ID
   * @param {string} [organizerUserId] - Required for application mode
   * @param {string} [userCacheKey] - Session key (delegated mode)
   * @returns {Object} Meeting object with joinUrl, participants, etc.
   */
  async getMeetingById(meetingId, organizerUserId = null, userCacheKey = null) {
    const mode = config.msGraph.authMode;
    logger.info(`[GraphMeetingService] Fetching meeting: ${meetingId} | mode: ${mode}`);

    let endpoint;
    if (mode === 'application') {
      if (!organizerUserId) {
        throw new AppError(
          'organizerUserId is required in application auth mode to look up a meeting.',
          HTTP_STATUS.BAD_REQUEST
        );
      }
      endpoint = `/users/${organizerUserId}/onlineMeetings/${meetingId}`;
    } else {
      endpoint = `/me/onlineMeetings/${meetingId}`;
    }

    try {
      const client = getGraphClient(userCacheKey);
      const meeting = await client.api(endpoint).get();

      logger.debug(`[GraphMeetingService] Meeting fetched: ${meeting.subject || meetingId}`);
      return meeting;
    } catch (err) {
      throw mapGraphError(err, `getMeetingById(${meetingId})`);
    }
  },
};

module.exports = graphMeetingService;
