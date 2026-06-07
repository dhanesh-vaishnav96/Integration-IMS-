/**
 * config/msGraphConfig.js
 *
 * Microsoft Graph API configuration builder.
 * Constructs MSAL (Microsoft Authentication Library) configuration objects
 * for both authentication modes:
 *
 * ┌──────────────────────┬────────────────────────────────────────────────┐
 * │ Mode                 │ Use Case                                       │
 * ├──────────────────────┼────────────────────────────────────────────────┤
 * │ DELEGATED            │ Local dev/personal testing. Acts as a logged-  │
 * │                      │ in user. Requires a real Microsoft 365 account.│
 * ├──────────────────────┼────────────────────────────────────────────────┤
 * │ APPLICATION          │ Production server-to-server. No user login.    │
 * │ (Client Credentials) │ Uses admin-consented app permissions.          │
 * └──────────────────────┴────────────────────────────────────────────────┘
 *
 * Azure Portal Setup Required:
 * 1. Go to: portal.azure.com → Entra ID → App Registrations → New registration
 * 2. Set Redirect URI to: http://localhost:5000/api/v1/ms/auth/callback
 * 3. Under "Certificates & secrets" → Create a client secret
 * 4. Under "API permissions" → Add the required delegated/application permissions
 * 5. Copy Tenant ID, Client ID, Client Secret to .env
 */
const config = require('./env');
const logger = require('./logger');

// ─── MSAL Authority URL ────────────────────────────────────────────────────
// For single-tenant apps, use tenant-specific authority.
// For multi-tenant, replace with 'https://login.microsoftonline.com/common'
const AUTHORITY = `https://login.microsoftonline.com/${config.msGraph.tenantId}`;

// ─── Scopes ────────────────────────────────────────────────────────────────
// Delegated: user-level permissions (requires user login)
const DELEGATED_SCOPES = config.msGraph.scopes;

// Application: app-level permissions (no user, requires admin consent)
// These are the .default scopes for client credentials flow
const APPLICATION_SCOPES = [
  `https://graph.microsoft.com/.default`,
];

// ─── MSAL Confidential Client Config (both modes use this base) ────────────
const msalConfig = {
  auth: {
    clientId: config.msGraph.clientId,
    clientSecret: config.msGraph.clientSecret,
    authority: AUTHORITY,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        // Map MSAL log levels to our winston logger
        if (level === 0) logger.error(`[MSAL] ${message}`);
        else if (level === 1) logger.warn(`[MSAL] ${message}`);
        else if (level === 2) logger.info(`[MSAL] ${message}`);
        else logger.debug(`[MSAL] ${message}`);
      },
      logLevel: config.env === 'development' ? 3 : 1, // Verbose in dev
      piiLoggingEnabled: false, // NEVER log PII in any environment
    },
  },
};

// ─── Validation ────────────────────────────────────────────────────────────
const validateMsGraphConfig = () => {
  const required = ['clientId', 'clientSecret', 'tenantId'];
  const missing = required.filter((key) => !config.msGraph[key]);

  if (missing.length > 0) {
    throw new Error(
      `MS Graph config missing: ${missing.map((k) => `AZURE_${k.toUpperCase()}`).join(', ')}`
    );
  }

  if (!['delegated', 'application'].includes(config.msGraph.authMode)) {
    throw new Error(
      `Invalid AUTH_MODE: '${config.msGraph.authMode}'. Must be 'delegated' or 'application'.`
    );
  }
};

module.exports = {
  msalConfig,
  AUTHORITY,
  DELEGATED_SCOPES,
  APPLICATION_SCOPES,
  REDIRECT_URI: config.msGraph.redirectUri,
  AUTH_MODE: config.msGraph.authMode,
  GRAPH_API_BASE_URL: config.msGraph.graphApiBaseUrl,
  validateMsGraphConfig,
};
