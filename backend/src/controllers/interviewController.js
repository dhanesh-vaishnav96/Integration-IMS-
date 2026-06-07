/**
 * controllers/interviewController.js
 *
 * Thin controller for Interview operations.
 * All business logic is in interviewService.
 */
const interviewService = require('../services/interviewService');
const assetService = require('../services/assetService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendNoContent } = require('../helpers/responseHelper');

/**
 * POST /api/v1/interviews
 */
const createInterview = asyncHandler(async (req, res) => {
  const interview = await interviewService.createInterview(req.body, req.requestId);
  return sendCreated(res, 'Interview scheduled successfully.', interview);
});

/**
 * GET /api/v1/interviews
 * Supports: ?page=1&limit=10&status=SCHEDULED&candidate_id=<id>
 */
const getInterviews = asyncHandler(async (req, res) => {
  const result = await interviewService.getInterviews(req.query);
  return sendSuccess(res, 'Interviews fetched successfully.', result);
});

/**
 * GET /api/v1/interviews/:id
 */
const getInterviewById = asyncHandler(async (req, res) => {
  const interview = await interviewService.getInterviewById(req.params.id);
  return sendSuccess(res, 'Interview fetched successfully.', interview);
});

/**
 * PUT /api/v1/interviews/:id
 */
const updateInterview = asyncHandler(async (req, res) => {
  const updated = await interviewService.updateInterview(req.params.id, req.body, req.requestId);
  return sendSuccess(res, 'Interview updated successfully.', updated);
});

/**
 * DELETE /api/v1/interviews/:id
 */
const deleteInterview = asyncHandler(async (req, res) => {
  const deletedBy = req.user?.email || 'system';
  await interviewService.deleteInterview(req.params.id, deletedBy, req.requestId);
  return sendNoContent(res);
});

/**
 * GET /api/v1/interviews/:id/assets
 * Fetch recording + transcript asset record for a specific interview.
 */
const getInterviewAssets = asyncHandler(async (req, res) => {
  const asset = await assetService.getAssetByInterview(req.params.id);
  return sendSuccess(res, 'Interview assets fetched successfully.', asset);
});

module.exports = {
  createInterview,
  getInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getInterviewAssets,
};
