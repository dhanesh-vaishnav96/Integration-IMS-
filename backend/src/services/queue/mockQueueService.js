/**
 * services/queue/mockQueueService.js
 *
 * Temporary Queue Abstraction Layer.
 * Replaces BullMQ while Redis is unavailable.
 * Matches BullMQ's basic interface so it can be swapped out later.
 */

const logger = require('../../config/logger');
const { prisma } = require('../../config/prisma');
const IQueueService = require('./IQueueService');

class MockQueueService extends IQueueService {
  constructor() {
    super();
    this.jobs = new Map(); // In-memory job state for mock tracking
  }

  async enqueue(queueName, jobName, payload, options = {}) {
    const jobId = `mock-job-${Date.now()}`;
    logger.info(`[MockQueue] 📥 Enqueued job '${jobName}' to queue '${queueName}' (ID: ${jobId})`);
    
    this.jobs.set(jobId, { status: 'PENDING', queueName, jobName, payload, options, attempts: 0 });

    // Simulate delay
    const delay = options.delay || 2000;
    setTimeout(async () => {
      await this.process(queueName, jobName, payload, jobId);
    }, delay);

    return { id: jobId };
  }

  // Backwards compatibility alias for webhookController
  async add(queueName, jobName, payload, options = {}) {
    return this.enqueue(queueName, jobName, payload, options);
  }

  async process(queueName, jobName, payload, jobId = null) {
    if (jobId && this.jobs.has(jobId)) {
      const job = this.jobs.get(jobId);
      job.status = 'PROCESSING';
      job.attempts += 1;
      this.jobs.set(jobId, job);
    }
    
    try {
      await this._processMockJob(queueName, jobName, payload);
      if (jobId && this.jobs.has(jobId)) {
        const job = this.jobs.get(jobId);
        job.status = 'UPLOADED'; // Or COMPLETED depending on queue
        this.jobs.set(jobId, job);
      }
    } catch (err) {
      if (jobId && this.jobs.has(jobId)) {
        await this.markFailed(queueName, jobId, err);
      }
      logger.error(`[MockQueue] ❌ Job failed: ${jobName} - ${err.message}`);
    }
  }

  async retry(queueName, jobId) {
    if (!this.jobs.has(jobId)) throw new Error('Job not found');
    const job = this.jobs.get(jobId);
    
    job.status = 'RETRYING';
    logger.info(`[MockQueue] 🔄 Retrying job ${jobId} in queue ${queueName}`);
    
    setTimeout(async () => {
      await this.process(job.queueName, job.jobName, job.payload, jobId);
    }, 1000);
  }

  async getStatus(queueName, jobId) {
    if (!this.jobs.has(jobId)) return 'UNKNOWN';
    return this.jobs.get(jobId).status;
  }

  async markFailed(queueName, jobId, error) {
    if (this.jobs.has(jobId)) {
      const job = this.jobs.get(jobId);
      job.status = 'FAILED';
      job.lastError = error.message;
      this.jobs.set(jobId, job);
    }
  }

  async _processMockJob(queueName, jobName, payload) {
    logger.info(`[MockQueue] ⚙️ Processing job: ${jobName}`);

    if (queueName === 'asset_processing' || jobName === 'process_meeting_assets') {
      const { interviewId, candidateId } = payload;
      if (!interviewId) throw new Error('Missing interviewId in payload');

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
        create: { interview_id: interviewId, ...mockAsset }
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
        create: { interview_id: interviewId, ...mockAsset }
      });
      logger.info(`[MockQueue] ✅ Created mock assets for interview from webhook: ${interviewId}`);
    } else {
      logger.warn(`[MockQueue] ⚠️ Unhandled queue or job: ${queueName} / ${jobName}`);
    }
  }
}

module.exports = new MockQueueService();
