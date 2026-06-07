/**
 * controllers/assetController.js
 *
 * Thin controller for InterviewAsset operations.
 * Primary consumer in Phase 2: dashboard read queries.
 * Phase 3 will add webhook-triggered asset creation.
 */
const assetService = require('../services/assetService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../helpers/responseHelper');

/**
 * GET /api/v1/candidates/:id/assets
 * Returns all recordings and transcripts for a candidate.
 * Used by the Candidate Dashboard in the React frontend.
 */
const getCandidateAssets = asyncHandler(async (req, res) => {
  const result = await assetService.getAssetsByCandidate(req.params.id, req.query);
  return sendSuccess(res, 'Candidate assets fetched successfully.', result);
});

module.exports = { getCandidateAssets };
