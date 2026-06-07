/**
 * services/assetService.js
 *
 * Business logic for InterviewAsset operations.
 * Handles fetching assets and generating pre-signed URLs.
 */

const AppError = require('../utils/AppError');
const assetRepository = require('../repositories/assetRepository');
const { interviewRepository } = require('../repositories');
const s3UploadService = require('./s3UploadService');
const logger = require('../config/logger');
const { HTTP_STATUS } = require('../constants');

const assetService = {
  /**
   * Get all assets (recordings + transcripts) for a candidate.
   * Used by the candidate dashboard endpoint.
   */
  async getAssetsByCandidate(candidateId, queryParams) {
    const result = await assetRepository.findByCandidateId(candidateId, queryParams);
    
    // Attach presigned URLs to all assets in the list
    for (let asset of result.data) {
      await assetService._attachPresignedUrls(asset);
    }
    
    return result;
  },

  /**
   * Get a single asset record for an interview.
   */
  async getAssetByInterview(interviewId) {
    // 1. Check if mock mode is enabled
    if (process.env.MOCK_GRAPH_ASSETS === 'true') {
      logger.info(`[AssetService] MOCK_GRAPH_ASSETS=true | Returning mock payload for interview: ${interviewId}`);
      return {
        id: `mock-asset-${interviewId}`,
        interview_id: interviewId,
        candidate_id: 'mock-candidate-id',
        recording_s3_key: 'recordings/mock-interview.mp4',
        transcript_s3_key: 'transcripts/mock-transcript.vtt',
        recording_status: 'UPLOADED',
        transcript_status: 'UPLOADED',
        recording_url: 'https://www.w3schools.com/html/mov_bbb.mp4', // Safe dummy video for testing
        transcript_url: 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A1%0A00:00:01.000%20--%3E%2000:00:05.000%0AMock%20transcript%20text%20for%20testing.',
        logs: [{ timestamp: new Date().toISOString(), message: 'Mock data generated.' }],
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

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

    // Attach short-lived presigned URLs for frontend rendering
    await assetService._attachPresignedUrls(asset);

    return asset;
  },

  /**
   * Upsert an asset record after S3 upload.
   * Called by the processing queue.
   */
  async saveAssetAfterUpload(interviewId, assetData, requestId) {
    const log = logger.child ? logger.child({ request_id: requestId }) : logger;

    const asset = await assetRepository.upsertByInterviewId(interviewId, assetData);
    log.info(`Asset saved for interview: ${interviewId} | recording: ${assetData.recording_status} | transcript: ${assetData.transcript_status}`);
    return asset;
  },

  /**
   * Helper to attach presigned URLs to an asset object inline
   */
  async _attachPresignedUrls(asset) {
    if (asset.recording_s3_key && asset.recording_status === 'UPLOADED') {
      asset.recording_url = await s3UploadService.generatePresignedUrl(asset.recording_s3_key);
    }
    if (asset.transcript_s3_key && asset.transcript_status === 'UPLOADED') {
      asset.transcript_url = await s3UploadService.generatePresignedUrl(asset.transcript_s3_key);
    }
  }
};

module.exports = assetService;