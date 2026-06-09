/**
 * services/processingService.js
 *
 * Orchestrates the download of meeting artifacts (Recording & Transcript)
 * from Microsoft Graph and uploads them to AWS S3.
 *
 * This service handles retries via `p-retry` because Graph APIs often return
 * 404 for artifacts immediately after a meeting ends. Artifacts can take
 * anywhere from 5 to 60+ minutes to become available.
 */
const pRetry = require('p-retry').default;
const { assetRepository, interviewRepository } = require('../repositories');
const artifactService = require('./msGraph/artifactService');
const s3UploadService = require('./s3UploadService');
const assetService = require('./assetService'); // Actually we need assetRepository

const logger = require('../config/logger');
const { ASSET_STATUS, S3_PATHS } = require('../constants');

const processingService = {
  /**
   * processArtifacts()
   *
   * Master pipeline for a resolved meeting mapping.
   *
   * @param {string} callRecordId
   * @param {Object} mapping - { interviewId, candidateId, meetingId }
   * @param {string|null} organizerUserId
   * @param {string|null} userCacheKey
   */
  async processArtifacts(callRecordId, mapping, organizerUserId = null, userCacheKey = null) {
    const { interviewId, candidateId, meetingId } = mapping;
    logger.info(`[ProcessingService] Starting artifact processing for interview: ${interviewId}`);
    
    let candidateName = null;
    let interviewTitle = null;
    try {
      const interview = await interviewRepository.findById(interviewId);
      if (interview) {
        candidateName = interview.candidate_id?.name || interview.candidate?.name;
        interviewTitle = interview.title || interview.round;
      }
    } catch(e) {
      logger.warn(`[ProcessingService] Could not fetch interview details for S3 paths: ${e.message}`);
    }

    mapping.candidateName = candidateName;
    mapping.interviewTitle = interviewTitle;

    if (process.env.MOCK_GRAPH_ASSETS === 'true') {
      logger.info(`[ProcessingService] MOCK_GRAPH_ASSETS=true | Creating mock assets in DB for interview: ${interviewId}`);
      await assetRepository.upsertByInterviewId(interviewId, {
        candidate_id: candidateId,
        recording_s3_key: S3_PATHS.RECORDING(candidateId, interviewId, candidateName, interviewTitle).replace('.mp4', '_mock.mp4'),
        recording_status: ASSET_STATUS.UPLOADED,
        transcript_s3_key: S3_PATHS.TRANSCRIPT(candidateId, interviewId, candidateName, interviewTitle).replace('.vtt', '_mock.vtt'),
        transcript_status: ASSET_STATUS.UPLOADED,
      });
      await assetRepository.appendLog(interviewId, ASSET_STATUS.UPLOADED, 'Mock assets successfully created.');
      return;
    }

    // Create or update the initial asset record to PROCESSING
    await assetRepository.upsertByInterviewId(interviewId, {
      candidate_id: candidateId,
      recording_status: ASSET_STATUS.PROCESSING,
      transcript_status: ASSET_STATUS.PROCESSING,
    });
    
    await assetRepository.appendLog(interviewId, ASSET_STATUS.PROCESSING, `Began processing callRecord: ${callRecordId}`);

    try {
      // Fetch existing asset to enable idempotency
      const existingAsset = await assetRepository.findByInterviewId(interviewId);
      const isRecordingUploaded = existingAsset && existingAsset.recording_status === ASSET_STATUS.UPLOADED;
      const isTranscriptUploaded = existingAsset && existingAsset.transcript_status === ASSET_STATUS.UPLOADED;

      let recordingFailed = false;

      if (isRecordingUploaded) {
        logger.info(`[ProcessingService] Recording already uploaded for interview ${interviewId}. Skipping.`);
      } else {
        const recordingResult = await processingService.processRecording(mapping, organizerUserId, userCacheKey);
        if (recordingResult.success) {
        await assetRepository.upsertByInterviewId(interviewId, {
          recording_s3_key: recordingResult.s3Key,
          recording_s3_url: recordingResult.s3Url,
          recording_status: ASSET_STATUS.UPLOADED,
        });
        await assetRepository.appendLog(interviewId, ASSET_STATUS.UPLOADED, 'Recording successfully uploaded to S3.');
        } else {
          recordingFailed = true;
          await assetRepository.upsertByInterviewId(interviewId, { recording_status: ASSET_STATUS.FAILED });
          await assetRepository.appendLog(interviewId, ASSET_STATUS.FAILED, `Recording processing failed: ${recordingResult.error}`);
        }
      }

      if (isTranscriptUploaded) {
        logger.info(`[ProcessingService] Transcript already uploaded for interview ${interviewId}. Skipping.`);
      } else {
        const transcriptResult = await processingService.processTranscript(mapping, organizerUserId, userCacheKey);
        if (transcriptResult.success) {
        await assetRepository.upsertByInterviewId(interviewId, {
          transcript_s3_key: transcriptResult.s3Key,
          transcript_s3_url: transcriptResult.s3Url,
          transcript_status: ASSET_STATUS.UPLOADED,
        });
        await assetRepository.appendLog(interviewId, ASSET_STATUS.UPLOADED, 'Transcript successfully uploaded to S3.');
        } else if (transcriptResult.status === ASSET_STATUS.UNAVAILABLE) {
          await assetRepository.upsertByInterviewId(interviewId, { transcript_status: ASSET_STATUS.UNAVAILABLE });
          await assetRepository.appendLog(interviewId, ASSET_STATUS.UNAVAILABLE, `Transcript was never generated or unavailable.`);
        } else {
          await assetRepository.upsertByInterviewId(interviewId, { transcript_status: ASSET_STATUS.FAILED });
          await assetRepository.appendLog(interviewId, ASSET_STATUS.FAILED, `Transcript processing failed: ${transcriptResult.error}`);
        }
      }

      // If recording failed, we still want to throw so the job can retry from SQS queue
      if (recordingFailed && !isRecordingUploaded) {
        throw new Error('Recording processing failed. Job will be retried.');
      }

    } catch (err) {
      logger.error(`[ProcessingService] Fatal error processing artifacts for ${interviewId}: ${err.message}`);
      await assetRepository.upsertByInterviewId(interviewId, {
        recording_status: ASSET_STATUS.FAILED,
        transcript_status: ASSET_STATUS.FAILED,
      });
      await assetRepository.appendLog(interviewId, ASSET_STATUS.FAILED, `Fatal processing error: ${err.message}`);
      throw err;
    }
  },

  /**
   * processRecording()
   */
  async processRecording(mapping, organizerUserId, userCacheKey) {
    const { interviewId, candidateId, meetingId } = mapping;
    logger.info(`[ProcessingService] Fetching recording for meeting: ${meetingId}`);

    try {
      // 1. Fetch recording list with retry
      const fetchList = async () => {
        const recordings = await artifactService.getRecordingsList(meetingId, organizerUserId, userCacheKey);
        if (!recordings || recordings.length === 0) {
          throw new Error('No recordings found yet.'); // Will trigger p-retry
        }
        return recordings;
      };

      // Retry up to 5 times (total ~30 mins waiting)
      const recordings = await pRetry(fetchList, {
        retries: 5,
        minTimeout: 60 * 1000, // 1 min
        maxTimeout: 10 * 60 * 1000, // 10 mins
        onFailedAttempt: error => {
          logger.warn(`[ProcessingService] Recording list fetch attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
        }
      });

      const recordingId = recordings[0].id; // Just take the first recording
      logger.info(`[ProcessingService] Found recording ID: ${recordingId}`);

      // 2. Download stream from Graph
      const stream = await artifactService.downloadRecordingStream(recordingId, meetingId, organizerUserId, userCacheKey);

      // 3. Upload to S3
      const uploadResult = await s3UploadService.uploadRecording(stream, candidateId, interviewId, 'video/mp4', null, mapping.candidateName, mapping.interviewTitle);

      return { success: true, s3Key: uploadResult.s3Key, s3Url: uploadResult.s3Url };

    } catch (err) {
      logger.error(`[ProcessingService] processRecording failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },

  /**
   * processTranscript()
   */
  async processTranscript(mapping, organizerUserId, userCacheKey) {
    const { interviewId, candidateId, meetingId } = mapping;
    logger.info(`[ProcessingService] Fetching transcript for meeting: ${meetingId}`);

    try {
      // 1. Fetch transcript list with retry
      const fetchList = async () => {
        const transcripts = await artifactService.getTranscriptsList(meetingId, organizerUserId, userCacheKey);
        if (!transcripts || transcripts.length === 0) {
          throw new Error('No transcripts found yet.');
        }
        return transcripts;
      };

      const transcripts = await pRetry(fetchList, {
        retries: 5,
        minTimeout: 60 * 1000,
        maxTimeout: 10 * 60 * 1000,
        onFailedAttempt: error => {
          logger.warn(`[ProcessingService] Transcript list fetch attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
        }
      });

      const transcriptId = transcripts[0].id;
      logger.info(`[ProcessingService] Found transcript ID: ${transcriptId}`);

      // 2. Download text content
      const content = await artifactService.downloadTranscriptContent(transcriptId, meetingId, organizerUserId, userCacheKey);

      // 3. Upload to S3
      const uploadResult = await s3UploadService.uploadTranscript(content, candidateId, interviewId, 'text/plain; charset=utf-8', null, mapping.candidateName, mapping.interviewTitle);

      return { success: true, s3Key: uploadResult.s3Key, s3Url: uploadResult.s3Url };

    } catch (err) {
      logger.error(`[ProcessingService] processTranscript failed: ${err.message}`);
      // Detect permanent 404 (transcript doesn't exist at all vs just not ready)
      // For now, if p-retry fails after 5 attempts, assume unavailable to prevent infinite loops
      return { success: false, status: ASSET_STATUS.UNAVAILABLE, error: err.message };
    }
  },
};

module.exports = processingService;