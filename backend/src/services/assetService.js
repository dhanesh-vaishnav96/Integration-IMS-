/**
 * services/assetService.js
 *
 * Business logic for InterviewAsset operations.
 * The primary consumer of this service in Phase 3 will be the SQS worker.
 * In Phase 2, it handles dashboard read queries.
 */


const AppError = require('../utils/AppError');
const { assetRepository, interviewRepository } = require('../repositories');
const logger = require('../config/logger');
const { HTTP_STATUS } = require('../constants');

const assetService = {
  /**
   * Get all assets (recordings + transcripts) for a candidate.
   * Used by the candidate dashboard endpoint.
   */
  async getAssetsByCandidate(candidateId, queryParams) {
    return assetRepository.findByCandidateId(candidateId, queryParams);
  },

  /**
   * Get a single asset record for an interview.
   */
  async getAssetByInterview(interviewId) {
    const interview = await interviewRepository.findById(interviewId);
    if (!interview) {
      throw new AppError('Interview not found.', HTTP_STATUS.NOT_FOUND);
    }

    const asset = await assetRepository.findByInterviewId(interviewId);
    if (!asset) {
      throw new AppError(
        'No assets found for this interview. Processing may still be in progress.',
        HTTP_STATUS.NOT_FOUND
      );
    }
    return asset;
  },

  /**
   * Upsert an asset record after S3 upload.
   * Called by the SQS worker in Phase 3.
   */
  async saveAssetAfterUpload(interviewId, assetData, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    const asset = await assetRepository.upsertByInterviewId(interviewId, assetData);
    log.info(`Asset saved for interview: ${interviewId} | recording: ${assetData.recording_status} | transcript: ${assetData.transcript_status}`);
    return asset;
  },
};

module.exports = assetService;