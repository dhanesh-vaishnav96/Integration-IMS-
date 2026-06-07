/**
 * services/msGraph/graphClientFactory.js
 *
 * Factory that creates authenticated Microsoft Graph API client instances.
 *
 * Why a factory?
 * - The Graph SDK requires an authentication provider.
 * - Our auth provider bridges the SDK with our tokenManager.
 * - Any service needing Graph API calls just calls: getGraphClient()
 *
 * Graph SDK vs. Raw axios:
 * - @microsoft/microsoft-graph-client handles retries, pagination, and
 *   consistent error format.
 * - For streaming (recording downloads in Phase 3B), we'll use raw axios
 *   since the SDK buffers the entire response.
 *
 * Usage:
 *   const { getGraphClient } = require('./graphClientFactory');
 *   const client = await getGraphClient(userCacheKey);
 *   const me = await client.api('/me').get();
 */
const { Client } = require('@microsoft/microsoft-graph-client');
const tokenManager = require('../token/tokenManager');
const logger = require('../../config/logger');

/**
 * Simple authentication provider that satisfies the Graph SDK interface.
 * The SDK calls `getAccessToken()` before every API request.
 */
class TokenManagerAuthProvider {
  constructor(userCacheKey) {
    this.userCacheKey = userCacheKey;
  }

  async getAccessToken() {
    return tokenManager.getAccessToken(this.userCacheKey);
  }
}

/**
 * Create an authenticated Microsoft Graph client.
 *
 * @param {string} [userCacheKey] - User session cache key (delegated mode only).
 *   Pass null or omit for application mode.
 * @returns {Client} Authenticated Graph client instance
 */
const getGraphClient = (userCacheKey = null) => {
  logger.debug(`[GraphClientFactory] Creating Graph client | session: ${userCacheKey || 'app-level'}`);

  const authProvider = new TokenManagerAuthProvider(userCacheKey);

  return Client.initWithMiddleware({
    authProvider,
    defaultVersion: 'v1.0', // Use stable v1.0 (not beta) for production
    debugLogging: false,
  });
};

module.exports = { getGraphClient };
