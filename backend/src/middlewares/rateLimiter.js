/**
 * rateLimiter.js
 *
 * Express-rate-limit configuration.
 * Two limiters are defined:
 *
 * 1. globalLimiter  — Applied to ALL /api/* routes. Liberal limit.
 * 2. authLimiter    — Applied specifically to auth routes. Strict limit
 *                     to protect against brute-force attacks.
 *
 * In production, consider using a Redis store (rate-limit-redis) so
 * limits are shared across multiple server instances.
 */
const rateLimit = require('express-rate-limit');
const { HTTP_STATUS } = require('../constants');

// Global limiter: 200 requests per 10 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 200,
  standardHeaders: true,  // Include RateLimit-* headers in response
  legacyHeaders: false,   // Disable X-RateLimit-* legacy headers
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 10 minutes.',
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

// Auth limiter: 20 requests per 15 minutes per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
});

module.exports = { globalLimiter, authLimiter };
