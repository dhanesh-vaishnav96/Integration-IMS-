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
      const expiresIn = cached.expiresAt
        ? Math.round((new Date(cached.expiresAt) - Date.now()) / 1000)
        : 'unknown';
      logger.debug(`[AppAuth] Using cached application token. Expires in: ${expiresIn}s`);
      return cached.accessToken;
    }

    logger.info('[AppAuth] Cache miss — fetching new application token via Client Credentials flow...');
    logger.debug(`[AppAuth] Config | tenantId: ${msalConfig.auth.authority} | clientId: ${msalConfig.auth.clientId ? msalConfig.auth.clientId.substring(0,8) + '...' : 'MISSING'}`);

    const client = getMsalClient();
    const start  = Date.now();

    try {
      const tokenRequest = { scopes: APPLICATION_SCOPES };
      logger.debug(`[AppAuth] Requesting scopes: ${APPLICATION_SCOPES.join(', ')}`);

      const response = await client.acquireTokenByClientCredential(tokenRequest);

      if (!response || !response.accessToken) {
        logger.error('[AppAuth] ❌ Token acquisition returned empty response — check Azure App Registration.');
        throw new AppError(
          'Application token acquisition failed: no access token returned.',
          HTTP_STATUS.INTERNAL_SERVER
        );
      }

      const durationMs = Date.now() - start;
      tokenCache.set(APP_TOKEN_CACHE_KEY, {
        accessToken: response.accessToken,
        expiresAt:   response.expiresOn,
        scope:       APPLICATION_SCOPES.join(' '),
      });

      logger.info(
        `[AppAuth] ✅ Application token acquired in ${durationMs}ms | ` +
        `expires: ${response.expiresOn?.toISOString()} | ` +
        `scopes: ${APPLICATION_SCOPES.join(', ')}`
      );
      return response.accessToken;
    } catch (err) {
      const durationMs = Date.now() - start;
      const graphCode  = err.errorCode || err.error || 'UNKNOWN';
      logger.error(
        `[AppAuth] ❌ Token acquisition FAILED after ${durationMs}ms | ` +
        `errorCode: ${graphCode} | message: ${err.message}`
      );

      // Emit specific fix hints for common AADSTS error codes
      if (err.message?.includes('AADSTS700016')) {
        logger.error('[AppAuth] FIX: AZURE_CLIENT_ID is invalid — verify App Registration in Azure Portal.');
      } else if (err.message?.includes('AADSTS7000215')) {
        logger.error('[AppAuth] FIX: AZURE_CLIENT_SECRET is invalid or expired — regenerate in Azure Portal.');
      } else if (err.message?.includes('AADSTS90002')) {
        logger.error('[AppAuth] FIX: AZURE_TENANT_ID is incorrect — copy from Entra ID → Overview page.');
      } else if (err.message?.includes('AADSTS65001')) {
        logger.error('[AppAuth] FIX: Admin consent not granted — Azure Portal → App Registration → API Permissions → Grant admin consent.');
      }

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
