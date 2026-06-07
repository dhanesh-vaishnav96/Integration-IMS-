/**
 * controllers/msGraphController.js
 *
 * Thin controller for MS Graph connectivity and auth test routes.
 *
 * Session Management (Phase 3A simplified):
 * - After /ms/auth/callback, the user's cacheKey is stored in res.locals or
 *   a simple server-side variable for Phase 3A single-user testing.
 * - Phase 4 will replace this with proper JWT session tokens.
 *
 * Route → Service mapping:
 *   GET /ms/auth/login       → delegatedAuthService.getLoginUrl()
 *   GET /ms/auth/callback    → delegatedAuthService.exchangeCodeForToken()
 *   GET /ms/auth/test        → graphMeetingService.verifyConnection()
 *   GET /ms/me               → graphMeetingService.getCurrentUser()
 *   GET /ms/users            → graphMeetingService.listUsers()
 *   GET /ms/meeting/:id      → graphMeetingService.getMeetingById()
 *   GET /ms/auth/cache       → tokenManager.inspectCache()  [dev only]
 *   DELETE /ms/auth/cache    → tokenManager.clearAll()      [dev only]
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../helpers/responseHelper');
const delegatedAuthService = require('../services/auth/delegatedAuthService');
const graphMeetingService = require('../services/msGraph/graphMeetingService');
const tokenManager = require('../services/token/tokenManager');
const logger = require('../config/logger');
const config = require('../config/env');
const { HTTP_STATUS } = require('../constants');

// In-memory session key for Phase 3A single-user testing
// Phase 4 will use JWT or server-side sessions
let _latestUserCacheKey = null;

/**
 * GET /api/v1/ms/auth/login
 * Redirects the user's browser to Microsoft's login page.
 * After login, Microsoft redirects to /ms/auth/callback.
 */
const loginWithMicrosoft = asyncHandler(async (req, res) => {
  if (config.msGraph.authMode === 'application') {
    return sendSuccess(res, 'Application auth mode does not require user login.', {
      authMode: 'application',
      hint: 'Use GET /api/v1/ms/auth/test to verify application token acquisition.',
    });
  }

  const loginUrl = await delegatedAuthService.getLoginUrl();
  logger.info(`[MsGraphCtrl] Redirecting to Microsoft login | requestId: ${req.requestId}`);
  res.redirect(loginUrl);
});

/**
 * GET /api/v1/ms/auth/callback
 * Azure AD redirects here with ?code=... after user logs in.
 * Exchanges the code for tokens and caches them.
 */
const handleAuthCallback = asyncHandler(async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    logger.error(`[MsGraphCtrl] Auth callback error: ${error} — ${error_description}`);
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Microsoft authentication failed.',
      error,
      error_description,
    });
  }

  if (!code) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Authorization code missing from callback. Restart the login flow.',
    });
  }

  const tokenData = await delegatedAuthService.exchangeCodeForToken(code);

  // Store for Phase 3A in-process testing
  _latestUserCacheKey = tokenData.cacheKey;
  tokenManager.setLatestUserKey(tokenData.cacheKey);

  logger.info(`[MsGraphCtrl] Auth successful for: ${tokenData.account.username}`);

  return sendSuccess(res, 'Authentication successful! You can now call Graph APIs.', {
    username: tokenData.account.username,
    name: tokenData.account.name,
    cacheKey: tokenData.cacheKey,
    expiresOn: tokenData.expiresOn,
    nextSteps: [
      'GET /api/v1/ms/auth/test — Verify connection',
      'GET /api/v1/ms/me — Get your profile',
      'GET /api/v1/ms/users — List directory users',
    ],
  });
});

/**
 * GET /api/v1/ms/auth/test
 * SUCCESS CRITERION for Phase 3A.
 * If this returns 200 with connected: true, authentication is working.
 */
const testConnection = asyncHandler(async (req, res) => {
  const start = Date.now();
  logger.info(`[MsGraphCtrl] Auth test called | mode: ${config.msGraph.authMode} | requestId: ${req.requestId}`);

  const result = await graphMeetingService.verifyConnection(_latestUserCacheKey);

  return sendSuccess(res, '✅ Microsoft Graph connection verified successfully!', {
    ...result,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/ms/me
 * Fetch the signed-in user's profile.
 * Only works in delegated mode.
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await graphMeetingService.getCurrentUser(_latestUserCacheKey);
  return sendSuccess(res, 'Current user profile fetched.', user);
});

/**
 * GET /api/v1/ms/users?limit=10
 * List users in the tenant directory.
 */
const listUsers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const users = await graphMeetingService.listUsers(limit, _latestUserCacheKey);
  return sendSuccess(res, `${users.length} user(s) fetched from directory.`, { users, count: users.length });
});

/**
 * GET /api/v1/ms/meeting/:meetingId
 * Fetch a Teams meeting by its Graph API meeting ID.
 */
const getMeeting = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const { organizerUserId } = req.query;

  const meeting = await graphMeetingService.getMeetingById(
    meetingId,
    organizerUserId || null,
    _latestUserCacheKey
  );
  return sendSuccess(res, 'Meeting details fetched.', meeting);
});

/**
 * GET /api/v1/ms/auth/cache  [DEV ONLY]
 * Inspect cached tokens without revealing the actual access token.
 */
const inspectTokenCache = asyncHandler(async (req, res) => {
  if (config.env === 'production') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Cache inspection is not available in production.',
    });
  }
  const cache = tokenManager.inspectCache();
  return sendSuccess(res, 'Token cache contents.', cache);
});

/**
 * DELETE /api/v1/ms/auth/cache  [DEV ONLY]
 * Clear all cached tokens (force re-authentication).
 */
const clearTokenCache = asyncHandler(async (req, res) => {
  tokenManager.clearAll();
  _latestUserCacheKey = null;
  return sendSuccess(res, 'Token cache cleared. Re-authenticate via /api/v1/ms/auth/login.');
});

module.exports = {
  loginWithMicrosoft,
  handleAuthCallback,
  testConnection,
  getMe,
  listUsers,
  getMeeting,
  inspectTokenCache,
  clearTokenCache,
};
