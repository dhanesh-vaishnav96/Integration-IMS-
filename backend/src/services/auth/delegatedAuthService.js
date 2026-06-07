/**
 * services/auth/delegatedAuthService.js
 *
 * Handles Delegated (user-context) authentication using MSAL Node.
 *
 * Flow:
 * ┌─────────────┐      ┌────────────────────┐      ┌──────────────────────┐
 * │  Browser    │─────>│  Our Backend       │─────>│  Azure AD (MSAL)    │
 * │  (User)     │      │  /ms/auth/login    │      │  OAuth 2.0 AuthCode  │
 * └─────────────┘      └────────────────────┘      └──────────────────────┘
 *       │                                                      │
 *       └──────────────── Redirect with code ─────────────────┘
 *                                  │
 *                         /ms/auth/callback
 *                                  │
 *                    Exchange code for access_token
 *                                  │
 *                    Cache tokens → return to client
 *
 * What "delegated" means:
 * - The access token represents a REAL signed-in user.
 * - Graph API calls are made "as" that user.
 * - User must have a Microsoft 365 / Teams license.
 * - Perfect for Phase 3A personal testing.
 *
 * Required Azure Portal setup:
 * - Platform: Web
 * - Redirect URI: http://localhost:5000/api/v1/ms/auth/callback
 * - Grant type: Authorization Code
 * - Delegated permissions: User.Read, OnlineMeetings.Read, OnlineMeetings.ReadWrite, offline_access
 */
const msal = require('@azure/msal-node');
const { msalConfig, DELEGATED_SCOPES, REDIRECT_URI } = require('../../config/msGraphConfig');
const tokenCache = require('../token/tokenCache');
const logger = require('../../config/logger');
const AppError = require('../../utils/AppError');
const { HTTP_STATUS } = require('../../constants');

// One MSAL ConfidentialClientApplication per process
let msalClient = null;

const getMsalClient = () => {
  if (!msalClient) {
    msalClient = new msal.ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
};

const delegatedAuthService = {
  /**
   * Step 1: Generate the Microsoft login URL.
   * Redirect the user's browser to this URL to begin OAuth 2.0 Authorization Code flow.
   *
   * @returns {string} Login URL to redirect the user to
   */
  async getLoginUrl() {
    const client = getMsalClient();

    const authCodeUrlParams = {
      redirectUri: REDIRECT_URI,
      scopes: DELEGATED_SCOPES,
      responseMode: msal.ResponseMode.QUERY, // Code in query params
    };

    const loginUrl = await client.getAuthCodeUrl(authCodeUrlParams);
    logger.info(`[DelegatedAuth] Login URL generated. Redirecting user to Azure AD.`);
    return loginUrl;
  },

  /**
   * Step 2: Exchange the authorization code for tokens.
   * Called in the /callback route after Azure AD redirects back.
   *
   * @param {string} code - Authorization code from Azure AD redirect
   * @returns {Object} { accessToken, account, expiresOn }
   */
  async exchangeCodeForToken(code) {
    const client = getMsalClient();

    const tokenRequest = {
      redirectUri: REDIRECT_URI,
      scopes: DELEGATED_SCOPES,
      code,
    };

    try {
      const response = await client.acquireTokenByCode(tokenRequest);

      if (!response || !response.accessToken) {
        throw new AppError('Token exchange failed: no access token in response.', HTTP_STATUS.UNAUTHORIZED);
      }

      // Cache the token using the account's home account ID as the key
      const cacheKey = `user:${response.account.homeAccountId}`;
      tokenCache.set(cacheKey, {
        accessToken: response.accessToken,
        expiresAt: response.expiresOn,
        account: response.account,
        scope: response.scopes?.join(' '),
      });

      logger.info(`[DelegatedAuth] Token acquired for user: ${response.account.username}`);
      return {
        accessToken: response.accessToken,
        expiresOn: response.expiresOn,
        account: response.account,
        cacheKey,
      };
    } catch (err) {
      logger.error(`[DelegatedAuth] Token exchange error: ${err.message}`);
      throw delegatedAuthService._mapMsalError(err);
    }
  },

  /**
   * Step 3: Silently refresh the token using the cached account.
   * If silent refresh fails, the user must re-authenticate.
   *
   * @param {string} cacheKey - Key used when the token was cached
   * @returns {string} Fresh access token
   */
  async getValidToken(cacheKey) {
    const client = getMsalClient();
    const cached = tokenCache.get(cacheKey);

    if (!cached) {
      throw new AppError(
        'No cached token found. Please authenticate first via /api/v1/ms/auth/login.',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // If token is still valid, return it directly
    if (!tokenCache.isExpired(cacheKey)) {
      logger.debug(`[DelegatedAuth] Using cached token for: ${cacheKey}`);
      return cached.accessToken;
    }

    // Token is expired → try silent refresh using the cached account
    logger.info(`[DelegatedAuth] Token expired. Attempting silent refresh for: ${cacheKey}`);
    try {
      const silentRequest = {
        account: cached.account,
        scopes: DELEGATED_SCOPES,
        forceRefresh: false,
      };

      const response = await client.acquireTokenSilent(silentRequest);

      // Update cache with refreshed token
      tokenCache.set(cacheKey, {
        accessToken: response.accessToken,
        expiresAt: response.expiresOn,
        account: response.account,
        scope: response.scopes?.join(' '),
      });

      logger.info(`[DelegatedAuth] Token silently refreshed for: ${cacheKey}`);
      return response.accessToken;
    } catch (err) {
      logger.warn(`[DelegatedAuth] Silent refresh failed: ${err.message}`);
      tokenCache.clear(cacheKey);
      throw new AppError(
        'Session expired. Please re-authenticate via /api/v1/ms/auth/login.',
        HTTP_STATUS.UNAUTHORIZED
      );
    }
  },

  /**
   * Maps MSAL errors to user-friendly AppErrors with correct HTTP status codes.
   */
  _mapMsalError(err) {
    const msg = err.message || '';

    if (msg.includes('AADSTS70011')) {
      return new AppError('Invalid scope. Check GRAPH_SCOPES in .env.', HTTP_STATUS.BAD_REQUEST);
    }
    if (msg.includes('AADSTS65001')) {
      return new AppError('Admin consent required. Grant permissions in Azure Portal.', HTTP_STATUS.FORBIDDEN);
    }
    if (msg.includes('AADSTS700016')) {
      return new AppError('Application not found in tenant. Check AZURE_CLIENT_ID.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (msg.includes('AADSTS7000215')) {
      return new AppError('Invalid client secret. Check AZURE_CLIENT_SECRET.', HTTP_STATUS.UNAUTHORIZED);
    }
    if (msg.includes('AADSTS90002')) {
      return new AppError('Tenant not found. Check AZURE_TENANT_ID.', HTTP_STATUS.UNAUTHORIZED);
    }

    return new AppError(`Microsoft auth error: ${msg}`, HTTP_STATUS.UNAUTHORIZED);
  },
};

module.exports = delegatedAuthService;
