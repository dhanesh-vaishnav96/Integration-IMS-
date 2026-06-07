/**
 * middlewares/authMiddleware.js
 *
 * JWT Authentication + Role Authorization middleware.
 *
 * DEVELOPMENT BYPASS:
 * Set DEV_BYPASS_AUTH=true in .env to skip JWT verification in non-production
 * environments. The production auth structure is kept fully intact:
 *   - In production (NODE_ENV=production), bypass is NEVER active, regardless
 *     of DEV_BYPASS_AUTH value.
 *   - In development/test, bypass injects a mock admin user (dev@system.local)
 *     so Teams endpoints can be tested without a full auth setup.
 *
 * To enable:  DEV_BYPASS_AUTH=true  (in .env, development only)
 * To disable: DEV_BYPASS_AUTH=false (or remove the variable)
 */

'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../config/logger');

// ─── Dev Bypass Logic ─────────────────────────────────────────────────────────

/**
 * Check whether the development auth bypass is active.
 * NEVER active in production, regardless of env var value.
 */
const isDevBypassActive = () => {
  const bypass    = process.env.DEV_BYPASS_AUTH === 'true';
  const isNotProd = process.env.NODE_ENV !== 'production';
  return bypass && isNotProd;
};

// Log bypass status once at startup (not per-request)
if (isDevBypassActive()) {
  logger.warn(
    '[AuthMiddleware] ⚠️  DEV_BYPASS_AUTH=true — JWT auth is DISABLED for this session. ' +
    'This MUST be false in production.'
  );
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * protect()
 *
 * Verifies the Bearer JWT in Authorization header.
 * In dev bypass mode, skips verification and injects a mock admin user.
 */
const protect = async (req, res, next) => {
  // ── Development bypass ────────────────────────────────────────────────────
  if (isDevBypassActive()) {
    req.user = {
      id:    'dev-bypass-user',
      email: 'dev@system.local',
      role:  'admin',
      name:  'Dev Bypass Admin',
    };
    logger.debug(`[AuthMiddleware] DEV_BYPASS: injected mock admin user for ${req.method} ${req.path}`);
    return next();
  }

  // ── Production JWT verification ───────────────────────────────────────────
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided.',
    });
  }

  try {
    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    // In production you would fetch the user from DB here:
    // req.user = await UserRepository.findById(decoded.id);
    req.user = decoded;

    return next();
  } catch (error) {
    logger.error(`[AuthMiddleware] Token verification failed: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Not authorized — invalid or expired token.',
    });
  }
};

/**
 * authorize(...roles)
 *
 * Role-based access control gate. Must be used after protect().
 * In dev bypass mode, the mock user has role 'admin' so all role checks pass.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied — role '${req.user?.role}' is not authorized for this route.`,
      });
    }
    return next();
  };
};

module.exports = { protect, authorize };
