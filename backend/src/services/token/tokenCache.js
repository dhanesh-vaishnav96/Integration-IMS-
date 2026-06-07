/**
 * services/token/tokenCache.js
 *
 * In-memory token cache for both delegated and application auth modes.
 *
 * Structure:
 * {
 *   "app_token"          : { accessToken, expiresAt, scope }  ← Application mode
 *   "user:<account_id>"  : { accessToken, refreshToken, expiresAt, account } ← Delegated
 * }
 *
 * Why in-memory (not Redis) for now?
 * - Sufficient for single-instance local dev and Phase 3A testing
 * - Phase 5 can swap this to Redis for multi-instance production:
 *   Just change the get/set/clear methods to use Redis commands.
 *
 * Token Refresh Logic:
 * - `isExpired()` returns true if the token expires within 5 minutes (buffer).
 *   This prevents making Graph API calls with a near-expired token.
 */
const logger = require('../../config/logger');

// 5-minute buffer before actual expiry → triggers proactive refresh
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

class TokenCache {
  constructor() {
    this._cache = new Map();
  }

  /**
   * Store a token entry in the cache.
   * @param {string} key - Cache key (e.g., 'app_token', 'user:<id>')
   * @param {Object} tokenData - { accessToken, refreshToken?, expiresAt, account? }
   */
  set(key, tokenData) {
    this._cache.set(key, {
      ...tokenData,
      cachedAt: new Date().toISOString(),
    });
    logger.debug(`[TokenCache] Token cached for key: ${key}`);
  }

  /**
   * Retrieve a cached token.
   * @returns {Object|null} Token data or null if not cached.
   */
  get(key) {
    return this._cache.get(key) || null;
  }

  /**
   * Check if a cached token is expired (or within the expiry buffer).
   * @param {string} key
   * @returns {boolean} true if expired or missing
   */
  isExpired(key) {
    const entry = this._cache.get(key);
    if (!entry || !entry.expiresAt) return true;
    const expiresAt = new Date(entry.expiresAt).getTime();
    const isExpired = Date.now() >= expiresAt - EXPIRY_BUFFER_MS;
    if (isExpired) {
      logger.debug(`[TokenCache] Token expired for key: ${key}`);
    }
    return isExpired;
  }

  /**
   * Remove a specific token from the cache.
   */
  clear(key) {
    this._cache.delete(key);
    logger.debug(`[TokenCache] Token cleared for key: ${key}`);
  }

  /**
   * Clear all cached tokens (e.g., on logout or config change).
   */
  clearAll() {
    this._cache.clear();
    logger.info('[TokenCache] All tokens cleared.');
  }

  /**
   * Inspect cache state (for debugging/testing only).
   */
  inspect() {
    const entries = {};
    this._cache.forEach((value, key) => {
      entries[key] = {
        cachedAt: value.cachedAt,
        expiresAt: value.expiresAt,
        hasRefreshToken: !!value.refreshToken,
        scope: value.scope,
      };
    });
    return entries;
  }
}

// Singleton — one shared cache instance across the entire app
module.exports = new TokenCache();
