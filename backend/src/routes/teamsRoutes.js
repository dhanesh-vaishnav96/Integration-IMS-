/**
 * routes/teamsRoutes.js
 *
 * Teams scheduling routes.
 *
 * Route Map:
 * ┌────────────────────────────┬──────────────────────────────────────────────────┐
 * │ Method + Path              │ Purpose                                          │
 * ├────────────────────────────┼──────────────────────────────────────────────────┤
 * │ POST   /teams/schedule     │ Create a Teams meeting for an interview          │
 * │ PUT    /teams/:id          │ Update the Teams meeting for an interview        │
 * │ DELETE /teams/:id          │ Cancel a Teams meeting + mark interview CANCELLED│
 * │ GET    /teams/:id          │ Get interview + live Teams meeting data          │
 * └────────────────────────────┴──────────────────────────────────────────────────┘
 *
 * :id in all routes = MongoDB Interview _id (NOT teams_meeting_id)
 *
 * Auth Note:
 * Routes currently open for Phase 3B testing.
 * Phase 4 will add `protect` middleware for JWT enforcement.
 *
 * Delegated Mode Testing:
 * Pass the user session cache key in header: X-User-Cache-Key: user:<homeAccountId>
 * (Obtained from /api/v1/ms/auth/callback response)
 */
const express = require('express');
const teamsController = require('../controllers/teamsController');
const { validateBody, validateParams } = require('../middlewares/validateRequest');
const {
  scheduleInterviewSchema,
  updateScheduleSchema,
  cancelScheduleSchema,
  interviewIdParamSchema,
} = require('../validators/teamsValidators');

const router = express.Router();

// POST /api/v1/teams/schedule
router.post(
  '/schedule',
  validateBody(scheduleInterviewSchema),
  teamsController.scheduleInterview
);

// GET /api/v1/teams/:id  — fetch interview + live Teams meeting data
router.get(
  '/:id',
  validateParams(interviewIdParamSchema),
  teamsController.getSchedule
);

// PUT /api/v1/teams/:id  — update Teams meeting
router.put(
  '/:id',
  validateParams(interviewIdParamSchema),
  validateBody(updateScheduleSchema),
  teamsController.updateSchedule
);

// DELETE /api/v1/teams/:id  — cancel Teams meeting
router.delete(
  '/:id',
  validateParams(interviewIdParamSchema),
  teamsController.cancelSchedule
);

module.exports = router;
