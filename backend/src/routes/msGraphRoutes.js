/**
 * routes/msGraphRoutes.js
 *
 * Microsoft Graph API test and auth routes.
 *
 * Route Map:
 * ┌───────────────────────────────┬────────────────────────────────────────────┐
 * │ Route                         │ Purpose                                    │
 * ├───────────────────────────────┼────────────────────────────────────────────┤
 * │ GET /ms/auth/login            │ Redirects to Microsoft login               │
 * │ GET /ms/auth/callback         │ Handles OAuth2 code exchange               │
 * │ GET /ms/auth/test             │ ✅ Phase 3A success criterion               │
 * │ GET /ms/auth/cache            │ [DEV] Inspect cached tokens                │
 * │ DELETE /ms/auth/cache         │ [DEV] Clear all cached tokens              │
 * │ GET /ms/me                    │ Current user profile (delegated only)      │
 * │ GET /ms/users                 │ List tenant users                          │
 * │ GET /ms/meeting/:meetingId    │ Fetch Teams meeting details                │
 * └───────────────────────────────┴────────────────────────────────────────────┘
 */
const express = require('express');
const msGraphController = require('../controllers/msGraphController');
const { validateParams, validateQuery } = require('../middlewares/validateRequest');
const {
  meetingIdParamSchema,
  getMeetingQuerySchema,
  listUsersQuerySchema,
} = require('../validators/msGraphValidators');

const router = express.Router();

// ─── Auth Flow ─────────────────────────────────────────────────────────────
// Step 1: Visit this in browser to start Microsoft login
router.get('/auth/login', msGraphController.loginWithMicrosoft);

// Step 2: Azure AD redirects here after user logs in
router.get('/auth/callback', msGraphController.handleAuthCallback);

// ─── Phase 3A Success Criterion ────────────────────────────────────────────
// If this returns 200, authentication is complete
router.get('/auth/test', msGraphController.testConnection);

// ─── Dev Tools (cache inspection) ──────────────────────────────────────────
router.get('/auth/cache', msGraphController.inspectTokenCache);
router.delete('/auth/cache', msGraphController.clearTokenCache);

// ─── Graph Data Endpoints ──────────────────────────────────────────────────
// Current signed-in user (delegated mode only)
router.get('/me', msGraphController.getMe);

// List users in directory
router.get(
  '/users',
  validateQuery(listUsersQuerySchema),
  msGraphController.listUsers
);

// Fetch a specific Teams meeting by Graph meeting ID
router.get(
  '/meeting/:meetingId',
  validateParams(meetingIdParamSchema),
  validateQuery(getMeetingQuerySchema),
  msGraphController.getMeeting
);

module.exports = router;
