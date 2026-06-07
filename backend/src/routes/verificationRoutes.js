/**
 * routes/verificationRoutes.js
 *
 * Phase 1 integration verification routes.
 * These routes are only available in non-production environments.
 *
 * Mounted at: /api/v1/verify
 *
 * All routes are protected by a dev-only guard:
 * If NODE_ENV=production, all routes return 403.
 */

'use strict';

const express = require('express');
const {
  verifyGraphToken,
  verifyGraphConnection,
  verifyTeamsMeeting,
  verifyCalendarBlock,
  verifyFlowStatus,
  verifyInterview,
} = require('../controllers/verificationController');

const router = express.Router();

// ── Dev-only guard middleware ──────────────────────────────────────────────────
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Verification endpoints are not available in production.',
    });
  }
  return next();
};

router.use(devOnly);

// ─── Pre-flight & Config ──────────────────────────────────────────────────────

// Full pre-flight checklist — start here
router.get('/flow-status',       verifyFlowStatus);

// Step 1: Can we get a Graph token?
router.get('/graph-token',       verifyGraphToken);

// Step 2: Can we call Graph API?
router.get('/graph-connection',  verifyGraphConnection);

// ─── Component Tests ──────────────────────────────────────────────────────────

// Step 3: Can we create a Teams meeting?
router.post('/teams-meeting',    verifyTeamsMeeting);

// Step 4: Can we create a calendar event for a panelist?
router.post('/calendar-block',   verifyCalendarBlock);

// ─── Interview Inspection ─────────────────────────────────────────────────────

// Deep-inspect a specific interview record + Graph status
router.get('/interview/:id',     verifyInterview);

module.exports = router;
