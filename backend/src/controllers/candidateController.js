/**
 * controllers/candidateController.js
 *
 * Thin controller — delegates ALL business logic to candidateService.
 * Responsibilities here:
 *  1. Extract request data (params, body, query)
 *  2. Call the service
 *  3. Send standardized response via responseHelper
 *
 * No business logic here. No try/catch (handled by asyncHandler).
 */
const candidateService = require('../services/candidateService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, sendNoContent } = require('../helpers/responseHelper');
const { HTTP_STATUS } = require('../constants');

/**
 * POST /api/v1/candidates
 */
const createCandidate = asyncHandler(async (req, res) => {
  const candidate = await candidateService.createCandidate(req.body, req.requestId);
  return sendCreated(res, 'Candidate created successfully.', candidate);
});

/**
 * GET /api/v1/candidates
 * Supports: ?page=1&limit=10&search=react&status=ACTIVE&job_role=Developer&sortBy=name&sortOrder=asc
 */
const getCandidates = asyncHandler(async (req, res) => {
  const result = await candidateService.getCandidates(req.query, req.requestId);
  return sendSuccess(res, 'Candidates fetched successfully.', result);
});

/**
 * GET /api/v1/candidates/:id
 */
const getCandidateById = asyncHandler(async (req, res) => {
  const candidate = await candidateService.getCandidateById(req.params.id, req.requestId);
  return sendSuccess(res, 'Candidate fetched successfully.', candidate);
});

/**
 * PUT /api/v1/candidates/:id
 */
const updateCandidate = asyncHandler(async (req, res) => {
  const updated = await candidateService.updateCandidate(
    req.params.id,
    req.body,
    req.requestId
  );
  return sendSuccess(res, 'Candidate updated successfully.', updated);
});

/**
 * DELETE /api/v1/candidates/:id
 * Soft delete — sets deletedAt, never destroys the record.
 */
const deleteCandidate = asyncHandler(async (req, res) => {
  const deletedBy = req.user?.email || req.body?.deletedBy || 'system';
  await candidateService.deleteCandidate(req.params.id, deletedBy, req.requestId);
  return sendNoContent(res);
});

module.exports = {
  createCandidate,
  getCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
};
