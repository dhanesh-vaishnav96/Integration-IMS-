/**
 * jobs/bullmq/workers/schedulingWorkers.js
 *
 * BullMQ workers for the Interview Scheduling module.
 * Handles: invite emails, reminders, Teams recording/transcript fetch.
 */
const { Worker } = require('bullmq');
const { getRedisConnection } = require('../../config/redis');
const logger = require('../../config/logger');
const { QUEUES } = require('./schedulingQueue');

let workers = [];

// ─── Worker Handlers ──────────────────────────────────────────────────────────

const handleSendInvite = async (job) => {
  const { interviewId, participants, interviewData } = job.data;
  logger.info(`[InviteWorker] Sending invites for interview: ${interviewId}`);
  // TODO: integrate with real email provider (SendGrid/SES)
  // For now, log the intent — real impl hooks into NotificationService
  logger.info(`[InviteWorker] Would send to: ${participants?.map(p => p.email).join(', ')}`);
};

const handleReminder = async (job) => {
  const { interviewId, recipientEmail, reminderType, interviewData } = job.data;
  logger.info(`[ReminderWorker] Sending ${reminderType} reminder to ${recipientEmail} for ${interviewId}`);
  // TODO: email/Teams notification dispatch
};

const handleRecordingFetch = async (job) => {
  const { interviewId, teamsMeetingId, organizerUserId } = job.data;
  logger.info(`[RecordingWorker] Fetching recording for interview: ${interviewId}`);
  // Delegates to existing processingService
  try {
    const processingService = require('../../../services/processingService');
    await processingService.processArtifacts(teamsMeetingId, { interviewId }, organizerUserId);
  } catch (err) {
    logger.error(`[RecordingWorker] Failed: ${err.message}`);
    throw err; // Re-throw for BullMQ retry
  }
};

const handleTeamsSync = async (job) => {
  const { interviewId, graphEventId, action } = job.data;
  logger.info(`[TeamsSyncWorker] Syncing Teams event ${graphEventId} for interview ${interviewId} — action: ${action}`);
};

// ─── Worker Factory ───────────────────────────────────────────────────────────

const startWorkers = () => {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('[SchedulingWorkers] Redis unavailable — workers not started');
    return;
  }

  const workerConfig = [
    { queue: QUEUES.SEND_INVITE,      handler: handleSendInvite,      concurrency: 5  },
    { queue: QUEUES.REMINDER_15M,     handler: handleReminder,         concurrency: 10 },
    { queue: QUEUES.REMINDER_30M,     handler: handleReminder,         concurrency: 10 },
    { queue: QUEUES.REMINDER_1H,      handler: handleReminder,         concurrency: 10 },
    { queue: QUEUES.REMINDER_1D,      handler: handleReminder,         concurrency: 10 },
    { queue: QUEUES.RECORDING_FETCH,  handler: handleRecordingFetch,   concurrency: 3  },
    { queue: QUEUES.TRANSCRIPT_FETCH, handler: handleRecordingFetch,   concurrency: 3  },
    { queue: QUEUES.TEAMS_SYNC,       handler: handleTeamsSync,        concurrency: 5  },
  ];

  for (const { queue, handler, concurrency } of workerConfig) {
    const worker = new Worker(queue, handler, { connection, concurrency });

    worker.on('completed', (job) => {
      logger.info(`[Worker:${queue}] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
      logger.error(`[Worker:${queue}] Job ${job?.id} failed: ${err.message}`);
    });

    workers.push(worker);
    logger.info(`[SchedulingWorkers] Worker started: ${queue} (concurrency: ${concurrency})`);
  }
};

const stopWorkers = async () => {
  await Promise.all(workers.map(w => w.close()));
  workers = [];
  logger.info('[SchedulingWorkers] All workers stopped');
};

module.exports = { startWorkers, stopWorkers };
