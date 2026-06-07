/**
 * services/queue/schedulingQueue.js
 *
 * BullMQ Queue setup for background scheduling tasks (invites, reminders).
 * Configured with exponential backoff, retry limits, and graceful degradation.
 */
const { Queue, QueueEvents } = require('bullmq');
const redisClient = require('../../config/redis');

// Centralize the connection settings
const connectionOpts = {
  connection: redisClient,
  // Graceful degradation: if Redis goes down, BullMQ buffers actions
  // and will resume when it comes back up, instead of throwing outright if configured properly.
};

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2s, 4s, 8s, 16s, 32s
  },
  removeOnComplete: true,
  removeOnFail: false, // Keep in queue history for DLQ analysis
};

// Main queue for processing invites, reminders, and graph syncs
const schedulingQueue = new Queue('schedulingQueue', {
  ...connectionOpts,
  defaultJobOptions,
});

// Event listener for the queue to implement DLQ
const queueEvents = new QueueEvents('schedulingQueue', connectionOpts);

queueEvents.on('failed', async ({ jobId, failedReason }) => {
  console.error(`[SchedulingQueue] Job ${jobId} failed completely. Reason: ${failedReason}`);
  // DLQ persistence is handled by the worker event hooks to ensure Prisma access
});

module.exports = {
  schedulingQueue,
  queueEvents
};
