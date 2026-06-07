/**
 * services/queue/mockQueueService.js
 *
 * Temporary Queue Abstraction Layer.
 * Replaces BullMQ while Redis is unavailable.
 * Matches BullMQ's basic interface so it can be swapped out later.
 */

const logger = require('../../config/logger');
const { prisma } = require('../../config/prisma');

const mockQueueService = {
  /**
   * Simulate enqueueing a job.
   * Runs the processing logic in the background with a delay.
   *
   * @param {string} queueName - Name of the queue (e.g., 'asset_processing', 'webhook_queue')
   * @param {string} jobName - Name of the job
   * @param {Object} payload - Data payload for the job
   * @param {Object} [options] - BullMQ options (ignored in mock)
   */
  async add(queueName, jobName, payload, options = {}) {
    logger.info(`[MockQueue] 📥 Enqueued job '${jobName}' to queue '${queueName}'`);

    // Simulate asynchronous background processing
    setTimeout(async () => {
      try {
        await this._processMockJob(queueName, jobName, payload);
      } catch (err) {
        logger.error(`[MockQueue] ❌ Job failed: ${jobName} - ${err.message}`);
      }
    }, 2000); // 2-second delay to simulate processing

    return { id: `mock-job-${Date.now()}` };
  },

  /**
   * Internal job processor router
   */
  async _processMockJob(queueName, jobName, payload) {
    logger.info(`[MockQueue] ⚙️ Processing job: ${jobName}`);

    if (queueName === 'asset_processing' || jobName === 'process_meeting_assets') {
      const { interviewId, candidateId } = payload;
      
      if (!interviewId) {
        throw new Error('Missing interviewId in payload');
      }

      // Upsert mock asset record in the DB to UPLOADED state
      const mockAsset = {
        candidate_id: candidateId,
        recording_s3_key: `recordings/${candidateId}/${interviewId}/mock-recording.mp4`,
        transcript_s3_key: `transcripts/${candidateId}/${interviewId}/mock-transcript.vtt`,
        recording_status: 'UPLOADED',
        transcript_status: 'UPLOADED',
        logs: [{ timestamp: new Date().toISOString(), message: 'Mock processing completed successfully.' }]
      };

      await prisma.interviewAsset.upsert({
        where: { interview_id: interviewId },
        update: mockAsset,
        create: {
          interview_id: interviewId,
          ...mockAsset
        }
      });

      logger.info(`[MockQueue] ✅ Processed assets for interview: ${interviewId}`);
    } else if (queueName === 'webhook_queue') {
      logger.info(`[MockQueue] ✅ Processed webhook payload for change type: ${payload.changeType}`);
      const interviewId = payload.resourceData?.meetingId || 'mock-interview-123';
      
      const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
      const candidateId = interview ? interview.candidate_id : '00000000-0000-0000-0000-000000000000';

      const mockAsset = {
        candidate_id: candidateId,
        recording_s3_key: `recordings/mock/${interviewId}/mock-recording.mp4`,
        transcript_s3_key: `transcripts/mock/${interviewId}/mock-transcript.vtt`,
        recording_status: 'UPLOADED',
        transcript_status: 'UPLOADED',
        logs: [{ timestamp: new Date().toISOString(), message: 'Webhook triggered Mock processing.' }]
      };

      await prisma.interviewAsset.upsert({
        where: { interview_id: interviewId },
        update: mockAsset,
        create: {
          interview_id: interviewId,
          ...mockAsset
        }
      });
      logger.info(`[MockQueue] ✅ Created mock assets for interview from webhook: ${interviewId}`);
    } else {
      logger.warn(`[MockQueue] ⚠️ Unhandled queue or job: ${queueName} / ${jobName}`);
    }
  }
};

module.exports = mockQueueService;
