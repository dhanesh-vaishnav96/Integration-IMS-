/**
 * controllers/dashboardController.js
 *
 * Phase 8 - Dashboard APIs
 * Retrieves candidate data and pre-signs S3 URLs for viewing assets.
 */
const asyncHandler = require('../utils/asyncHandler');
const { candidateRepository, interviewRepository, assetRepository } = require('../repositories');
const { sendSuccess } = require('../helpers/responseHelper');



const s3UploadService = require('../services/s3UploadService');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

/**
 * GET /api/v1/dashboard/candidate/:id
 * Fetches the complete dashboard view for a candidate:
 * - Candidate profile
 * - List of interviews
 * - Asset processing status
 */
const getCandidateDashboard = asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  const candidate = await candidateRepository.findById(candidateId);
  if (!candidate) throw new AppError('Candidate not found', HTTP_STATUS.NOT_FOUND);

  const interviews = await interviewRepository.findByCandidateId(candidateId);
  const assets = await assetRepository.findByCandidateId(candidateId);

  // Group assets by interview ID for easy frontend mapping
  const assetsMap = {};
  const assetsList = Array.isArray(assets) ? assets : (assets?.data || []);
  assetsList.forEach((a) => {
    assetsMap[a.interview_id] = a;
  });

  const dashboardData = {
    candidate,
    interviews: interviews.map(i => {
      const interviewObj = i.toObject ? i.toObject() : i;
      return {
        ...interviewObj,
        assets: assetsMap[i._id.toString()] || null,
      };
    }),
  };

  return sendSuccess(res, 'Dashboard data fetched.', dashboardData);
});

/**
 * GET /api/v1/dashboard/candidate/:id/asset-links
 * Generates presigned URLs for a specific interview's assets.
 * Requires query param: ?interviewId=...
 */
const getAssetLinks = asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const { interviewId } = req.query;

  if (!interviewId) throw new AppError('interviewId query parameter is required', HTTP_STATUS.BAD_REQUEST);

  const asset = await assetRepository.findByInterviewId(interviewId);
  if (!asset) throw new AppError('No assets found for this interview', HTTP_STATUS.NOT_FOUND);

  const responseLinks = {
    recordingUrl: null,
    transcriptUrl: null,
  };

  if (asset.recording_status === 'UPLOADED' && asset.recording_s3_key) {
    responseLinks.recordingUrl = await s3UploadService.generatePresignedUrl(asset.recording_s3_key);
  }

  if (asset.transcript_status === 'UPLOADED' && asset.transcript_s3_key) {
    responseLinks.transcriptUrl = await s3UploadService.generatePresignedUrl(asset.transcript_s3_key);
  }

  return sendSuccess(res, 'Asset links generated.', responseLinks);
});

module.exports = {
  getCandidateDashboard,
  getAssetLinks,
};