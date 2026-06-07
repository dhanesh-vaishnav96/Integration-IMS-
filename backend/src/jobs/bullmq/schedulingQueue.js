/**
 * jobs/bullmq/schedulingQueue.js
 *
 * BullMQ queue definitions for the Interview Scheduling Module.
 * Falls back gracefully when Redis is unavailable.
 */
const { Queue } = require('bullmq');
const { getRedisConnection } = require('../../config/redis');
const logger = require('../../config/logger');

const QUEUES = {
  SEND_INVITE:       'scheduling_send_invite',
  REMINDER_15M:      'scheduling_reminder_15m',
  REMINDER_30M:      'scheduling_reminder_30m',
  REMINDER_1H:       'scheduling_reminder_1h',
  REMINDER_1D:       'scheduling_reminder_1d',
  RECORDING_FETCH:   'scheduling_recording_fetch',
  TRANSCRIPT_FETCH:  'scheduling_transcript_fetch',
  TEAMS_SYNC:        'scheduling_teams_sync',
};

const queues = {};

const initQueues = () => {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('[SchedulingQueue] Redis unavailable — queues disabled (dev mode)');
    return null;
  }

  for (const [key, name] of Object.entries(QUEUES)) {
    queues[key] = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
    logger.info(`[SchedulingQueue] Queue initialized: ${name}`);
  }
  return queues;
};

const getQueue = (key) => queues[key] || null;

/**
 * Add a job to a queue by key.
 * If Redis is unavailable, logs a warning and continues.
 */
const enqueue = async (queueKey, data, opts = {}) => {
  const q = getQueue(queueKey);
  if (!q) {
    logger.warn(`[SchedulingQueue] Queue ${queueKey} unavailable — job skipped: ${JSON.stringify(data)}`);
    return null;
  }
  try {
    const job = await q.add(queueKey, data, opts);
    logger.info(`[SchedulingQueue] Enqueued job ${job.id} on ${queueKey}`);
    return job;
  } catch (err) {
    logger.error(`[SchedulingQueue] Failed to enqueue on ${queueKey}: ${err.message}`);
    return null;
  }
};

/**
 * Schedule a delayed reminder job.
 * @param {string} queueKey - one of QUEUES keys
 * @param {Object} data     - job payload
 * @param {Date}   runAt    - when to run
 */
const scheduleAt = async (queueKey, data, runAt) => {
  const delay = Math.max(0, new Date(runAt).getTime() - Date.now());
  return enqueue(queueKey, data, { delay });
};

module.exports = { initQueues, getQueue, enqueue, scheduleAt, QUEUES };
