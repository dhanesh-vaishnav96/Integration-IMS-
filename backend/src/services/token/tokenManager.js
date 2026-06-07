/**
 * services/token/tokenManager.js
 *
 * Unified Token Manager — the single point of contact for getting a valid
 * Microsoft Graph access token anywhere in the application.
 *
 * Strategy (reads AUTH_MODE from env):
 * ┌───────────────┬──────────────────────────────────────────────────────────┐
 * │ AUTH_MODE     │ Strategy                                                 │
 * ├───────────────┼──────────────────────────────────────────────────────────┤
 * │ 'delegated'   │ Requires a cached user session. Token acquired via       │
 * │               │ OAuth2 auth-code flow. Call /ms/auth/login first.        │
 * ├───────────────┼──────────────────────────────────────────────────────────┤
 * │ 'application' │ Self-contained. Fetches token using client credentials.  │
 * │               │ No user login needed. Requires admin consent in Azure.   │
 * └───────────────┴──────────────────────────────────────────────────────────┘
 *
 * Usage from any service:
 *   const tokenManager = require('./tokenManager');
 *   const token = await tokenManager.getAccessToken(sessionKey);
 */
const config = require('../../config/env');
const logger = require('../../config/logger');
const delegatedAuthService = require('../auth/delegatedAuthService');
const applicationAuthService = require('../auth/applicationAuthService');
const AppError = require('../../utils/AppError');
const { HTTP_STATUS } = require('../../constants');

const tokenManager = {
  /**
   * Get a valid access token based on the configured AUTH_MODE.
   *
   * @param {string} [userCacheKey] - Required only in 'delegated' mode.
   *   This is the key returned after /ms/auth/callback.
   *   In application mode, this param is ignored.
   * @returns {Promise<string>} Valid Microsoft Graph access token
   */
  async getAccessToken(userCacheKey = null) {
    const mode = config.msGraph.authMode;
    logger.debug(`[TokenManager] Getting token | mode: ${mode}`);

    if (mode === 'application') {
      return applicationAuthService.getAccessToken();
    }

    if (mode === 'delegated') {
      // For testing, we try to use the first available cached user token
      // In production, userCacheKey would come from the session/JWT
      const effectiveKey = userCacheKey || 'user:latest';

      return delegatedAuthService.getValidToken(effectiveKey);
    }

    throw new AppError(
      `Unknown AUTH_MODE: '${mode}'. Set AUTH_MODE=delegated or AUTH_MODE=application in .env`,
      HTTP_STATUS.INTERNAL_SERVER
    );
  },

  /**
   * Store the "latest" user session key after delegated login.
   * This is a Phase 3A convenience for single-user testing.
   * Phase 4 will replace this with proper session management.
   */
  setLatestUserKey(cacheKey) {
    // We reuse the tokenCache to store a meta-entry pointing to the latest user
    const tokenCache = require('./tokenCache');
    tokenCache.set('user:latest', { redirectKey: cacheKey, expiresAt: null });
    logger.info(`[TokenManager] Latest user session set: ${cacheKey}`);
  },

  /**
   * Inspect what's currently cached (debugging only).
   */
  inspectCache() {
    const tokenCache = require('./tokenCache');
    return tokenCache.inspect();
  },

  /**
   * Clear all cached tokens (logout / key rotation).
   */
  clearAll() {
    const tokenCache = require('./tokenCache');
    tokenCache.clearAll();
  },
};

module.exports = tokenManager;
