/**
 * controllers/teamsController.js
 *
 * Thin controller for Teams scheduling routes.
 * Delegates ALL business logic to teamsSchedulingService.
 *
 * Session note (Phase 3B):
 * - We read userCacheKey from req.headers['x-user-cache-key'] for delegated mode testing.
 * - In Phase 4 (Auth), this will come from JWT claims / session.
 * - organizerUserId is read from req.body for application mode.
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendNoContent } = require('../helpers/responseHelper');
const teamsSchedulingService = require('../services/teamsSchedulingService');
const logger = require('../config/logger');

/**
 * Helper: extract auth context from request for Graph API calls.
 * Reads user session key from header (delegated) or body (application mode).
 */
const extractOptions = (req) => ({
  organizerUserId: req.body?.organizer_user_id || req.query?.organizer_user_id || null,
  userCacheKey: req.headers['x-user-cache-key'] || null,
  updatedBy: req.user?.email || req.body?.updated_by || 'system',
  cancelledBy: req.user?.email || req.body?.cancelled_by || 'system',
});

/**
 * POST /api/v1/teams/schedule
 *
 * Creates a Teams meeting for an existing interview.
 * The interview record must already exist (Phase 2).
 *
 * Request body:
 *   { interview_id, organizer_user_id? }
 *
 * Response:
 *   { interview: {...}, teams: { id, joinUrl, subject, startDateTime, endDateTime } }
 */
const scheduleInterview = asyncHandler(async (req, res) => {
  const { interview_id } = req.body;
  const options = extractOptions(req);

  logger.info(`[TeamsCtrl] Schedule interview: ${interview_id} | requestId: ${req.requestId}`);

  const result = await teamsSchedulingService.scheduleInterview(interview_id, options);

  return sendCreated(res, 'Teams meeting created and linked to interview successfully.', result);
});

/**
 * PUT /api/v1/teams/:id
 *
 * Updates the Teams meeting for an interview.
 * :id = MongoDB interview _id
 *
 * Request body: { subject?, scheduled_time?, duration_minutes?, organizer_user_id? }
 */
const updateSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const options = extractOptions(req);

  logger.info(`[TeamsCtrl] Update schedule: ${id} | requestId: ${req.requestId}`);

  const result = await teamsSchedulingService.updateScheduledInterview(id, req.body, options);

  return sendSuccess(res, 'Teams meeting updated successfully.', result);
});

/**
 * DELETE /api/v1/teams/:id
 *
 * Cancels the Teams meeting and marks the interview as CANCELLED.
 * :id = MongoDB interview _id
 */
const cancelSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const options = extractOptions(req);
  options.cancelledBy = options.cancelledBy || 'system';

  logger.info(`[TeamsCtrl] Cancel schedule: ${id} | requestId: ${req.requestId}`);

  const updated = await teamsSchedulingService.cancelScheduledInterview(id, options);

  return sendSuccess(res, 'Teams meeting cancelled and interview marked as CANCELLED.', updated);
});

/**
 * GET /api/v1/teams/:id
 *
 * Returns interview details + live Teams meeting info from Graph API.
 * :id = MongoDB interview _id
 */
const getSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const options = extractOptions(req);

  logger.info(`[TeamsCtrl] Get schedule: ${id} | requestId: ${req.requestId}`);

  const result = await teamsSchedulingService.getScheduledInterview(id, options);

  return sendSuccess(res, 'Interview schedule fetched successfully.', result);
});

module.exports = { scheduleInterview, updateSchedule, cancelSchedule, getSchedule };
