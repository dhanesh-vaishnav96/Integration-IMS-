/**
 * services/queue/jobProcessor.js
 *
 * Processes individual SQS job messages.
 * This is the core of Phase 5 — maps meeting ID → interview → candidate,
 * then fetches and uploads recording + transcript.
 *
 * Pluggable processor: add new job types here as the system grows.
 */
const logger = require('../../config/logger');
const webhookEventRepository = require('../../repositories/webhookEventRepository');
const mappingService = require('../mappingService');
const processingService = require('../processingService');

const jobProcessor = {
  /**
   * process()
   *
   * Routes a job message to the appropriate handler.
   * @param {Object} job - Parsed SQS message body
   */
  async process(job) {
    const { type, change_id, attempt } = job;
    logger.info(`[JobProcessor] Processing | type: ${type} | change_id: ${change_id} | attempt: ${attempt}`);

    await webhookEventRepository.updateStatus(change_id, 'PROCESSING');

    try {
      switch (type) {
        case 'PROCESS_CALL_RECORD':
          await jobProcessor.handleCallRecord(job);
          break;

        default:
          logger.warn(`[JobProcessor] Unknown job type: ${type} — ignoring`);
          await webhookEventRepository.updateStatus(change_id, 'IGNORED');
          return;
      }

      await webhookEventRepository.updateStatus(change_id, 'PROCESSED');
      logger.info(`[JobProcessor] ✅ Job completed: ${change_id}`);
    } catch (err) {
      logger.error(`[JobProcessor] Job failed: ${change_id} | ${err.message}`);
      await webhookEventRepository.updateStatus(change_id, 'FAILED', { error_message: err.message });
      throw err; // Re-throw so SQS consumer can handle visibility/DLQ
    }
  },

  /**
   * handleCallRecord()
   *
   * Main processing pipeline for a completed Teams call:
   *   1. Extract call record ID from resource data
   *   2. Map call record → interview → candidate (via mappingService)
   *   3. Fetch recording + transcript from Graph (processingService)
   *   4. Upload to S3 (processingService)
   *   5. Update InterviewAsset in MongoDB
   */
  async handleCallRecord(job) {
    const callRecordId = job.resource_data?.id || job.resource?.split('/').pop();

    if (!callRecordId) {
      logger.warn(`[JobProcessor] No call record ID in job: ${JSON.stringify(job)}`);
      return;
    }

    logger.info(`[JobProcessor] Handling call record: ${callRecordId}`);

    // Step 1: Map to interview + candidate
    const mapping = await mappingService.resolveCallRecord(callRecordId);
    if (!mapping) {
      logger.warn(`[JobProcessor] No interview mapping found for call record: ${callRecordId} — orphan recording`);
      return;
    }

    logger.info(
      `[JobProcessor] Mapped → interviewId: ${mapping.interviewId} | candidateId: ${mapping.candidateId}`
    );

    // Step 2: Fetch + Upload artifacts (Application Auth requires organizerUserId)
    await processingService.processArtifacts(callRecordId, mapping, mapping.organizerUserId);
  },
};

module.exports = jobProcessor;
