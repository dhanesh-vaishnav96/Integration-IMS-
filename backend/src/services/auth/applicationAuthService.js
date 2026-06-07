/**
 * services/auth/applicationAuthService.js
 *
 * Handles Application (service-to-server) authentication using Client Credentials flow.
 *
 * Flow:
 * ┌──────────────────────┐           ┌──────────────────────────┐
 * │  Our Backend         │──────────>│  Azure AD                │
 * │  (No user involved)  │  clientId  │  Client Credentials Flow │
 * │                      │  +secret   │                          │
 * └──────────────────────┘<──────────└──────────────────────────┘
 *          │                               access_token
 *          ▼
 *     Graph API Calls
 *     (as the application, not a user)
 *
 * Key Differences from Delegated:
 * - No user login required.
 * - Requires admin to consent to Application permissions in Azure Portal.
 * - Token represents the APPLICATION, not a specific user.
 * - Required permissions must be "Application" type (not Delegated).
 *
 * Required Azure Portal setup for Production (Phase 5):
 * - API Permissions → Application type:
 *   OnlineMeetings.Read.All
 *   OnlineMeetings.ReadWrite.All
 *   CallRecords.Read.All
 *   User.Read.All
 * - Admin must click "Grant admin consent"
 *
 * IMPORTANT: Application tokens have a 1-hour TTL.
 * Our tokenCache handles automatic re-acquisition when near expiry.
 */
const msal = require('@azure/msal-node');
const { msalConfig, APPLICATION_SCOPES } = require('../../config/msGraphConfig');
const tokenCache = require('../token/tokenCache');
const logger = require('../../config/logger');
const AppError = require('../../utils/AppError');
const { HTTP_STATUS } = require('../../constants');

const APP_TOKEN_CACHE_KEY = 'app_token'; // Fixed key for application-level token

let msalClient = null;

const getMsalClient = () => {
  if (!msalClient) {
    msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
};

const applicationAuthService = {
  /**
   * Acquire an application-level access token for Microsoft Graph.
   * Uses the cache: only fetches a new token if the cached one is expired.
   *
   * @returns {string} Valid access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (!tokenCache.isExpired(APP_TOKEN_CACHE_KEY)) {
      const cached = tokenCache.get(APP_TOKEN_CACHE_KEY);
      logger.debug('[AppAuth] Using cached application token.');
      return cached.accessToken;
    }

    logger.info('[AppAuth] Fetching new application token via Client Credentials...');
    const client = getMsalClient();

    try {
      const tokenRequest = {
        scopes: APPLICATION_SCOPES,
      };

      const response = await client.acquireTokenByClientCredential(tokenRequest);

      if (!response || !response.accessToken) {
        throw new AppError(
          'Application token acquisition failed: no access token returned.',
          HTTP_STATUS.INTERNAL_SERVER
        );
      }

      // Cache the token
      tokenCache.set(APP_TOKEN_CACHE_KEY, {
        accessToken: response.accessToken,
        expiresAt: response.expiresOn,
        scope: APPLICATION_SCOPES.join(' '),
      });

      logger.info(
        `[AppAuth] Token acquired. Expires: ${response.expiresOn?.toISOString()}`
      );
      return response.accessToken;
    } catch (err) {
      logger.error(`[AppAuth] Token acquisition error: ${err.message}`);
      throw applicationAuthService._mapMsalError(err);
    }
  },

  /**
   * Force-clear the cached application token (useful if token is revoked).
   */
  clearToken() {
    tokenCache.clear(APP_TOKEN_CACHE_KEY);
    logger.info('[AppAuth] Application token cache cleared.');
  },

  /**
   * Maps MSAL errors to structured AppErrors.
   */
  _mapMsalError(err) {
    const msg = err.message || '';
    if (msg.includes('AADSTS700016')) {
      return new AppError('Application not found. Check AZURE_CLIENT_ID.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (msg.includes('AADSTS7000215')) {
      return new AppError('Invalid client secret. Check AZURE_CLIENT_SECRET.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (msg.includes('AADSTS90002')) {
      return new AppError('Tenant not found. Check AZURE_TENANT_ID.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (msg.includes('AADSTS65001')) {
      return new AppError(
        'Admin consent not granted. Go to Azure Portal → API Permissions → Grant admin consent.',
        HTTP_STATUS.FORBIDDEN
      );
    }
    return new AppError(`Application auth error: ${msg}`, HTTP_STATUS.INTERNAL_SERVER);
  },
};

module.exports = applicationAuthService;
