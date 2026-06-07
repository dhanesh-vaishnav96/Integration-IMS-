/**
 * jobs/sqsWorker.js
 *
 * SQS Consumer Worker — long-polling SQS and dispatching jobs to jobProcessor.
 *
 * Uses the `sqs-consumer` library for clean long-polling with:
 * - Automatic message deletion on success
 * - Visibility timeout extension for long-running jobs
 * - Automatic DLQ routing on repeated failure (configured in AWS Console)
 *
 * Start from server.js: require('./src/jobs/sqsWorker').start();
 *
 * Environment Variables Required:
 *   SQS_QUEUE_URL            - Main queue URL
 *   SQS_BATCH_SIZE           - Messages per poll (1-10, default 5)
 *   SQS_VISIBILITY_TIMEOUT   - Seconds before message re-appears (default 300)
 *   SQS_WAIT_TIME_SECONDS    - Long-poll wait time (1-20, default 20)
 */
const { Consumer } = require('sqs-consumer');
const { getSQSClient } = require('../config/awsConfig');
const config = require('../config/env');
const logger = require('../config/logger');
const jobProcessor = require('../services/queue/jobProcessor');

let consumer = null;

const start = () => {
  const queueUrl = config.aws.sqsQueueUrl;

  if (!queueUrl) {
    logger.warn('[SQSWorker] SQS_QUEUE_URL not configured — worker not started');
    return;
  }

  // Skip worker if explicitly disabled (useful in dev without real AWS creds)
  if (process.env.SQS_ENABLED === 'false') {
    logger.warn('[SQSWorker] SQS_ENABLED=false — worker disabled. Set SQS_ENABLED=true when AWS credentials are ready.');
    return;
  }

  consumer = Consumer.create({
    queueUrl,
    batchSize: parseInt(process.env.SQS_BATCH_SIZE || '5', 10),
    visibilityTimeout: parseInt(process.env.SQS_VISIBILITY_TIMEOUT || '900', 10), // Default 15 mins to cover p-retry
    waitTimeSeconds: parseInt(process.env.SQS_WAIT_TIME_SECONDS || '20', 10),
    heartbeatInterval: 60, // Automatically extend visibility every 60s while processing
    sqs: getSQSClient(),

    handleMessage: async (message) => {
      let job;
      try {
        job = JSON.parse(message.Body);
      } catch (parseErr) {
        logger.error(`[SQSWorker] Failed to parse message body: ${message.Body}`);
        return; // Don't throw — message will be deleted (malformed, no point retrying)
      }

      logger.info(`[SQSWorker] Received message | type: ${job.type} | MessageId: ${message.MessageId}`);

      try {
        await jobProcessor.process(job);
        logger.info(`[SQSWorker] Message processed: ${message.MessageId}`);
      } catch (err) {
        logger.error(`[SQSWorker] Job failed (will retry or go to DLQ): ${err.message}`);
        throw err; // Throw to prevent auto-deletion → message returns to queue / DLQ
      }
    },

    handleProcessingError: (err) => {
      logger.error(`[SQSWorker] Processing error: ${err.message}`);
    },

    handleMessageBatch: undefined,
  });

  consumer.on('error', (err) => {
    logger.error(`[SQSWorker] Consumer error: ${err.message}`);
  });

  consumer.on('processing_error', (err) => {
    logger.error(`[SQSWorker] Processing error: ${err.message}`);
  });

  consumer.on('timeout_error', (err) => {
    logger.warn(`[SQSWorker] Timeout error: ${err.message}`);
  });

  consumer.on('message_received', (msg) => {
    logger.debug(`[SQSWorker] Message received: ${msg.MessageId}`);
  });

  consumer.on('message_processed', (msg) => {
    logger.debug(`[SQSWorker] Message deleted from queue: ${msg.MessageId}`);
  });

  consumer.start();
  logger.info(`[SQSWorker] Started polling queue: ${queueUrl}`);

  return consumer;
};

const stop = () => {
  if (consumer) {
    consumer.stop();
    logger.info('[SQSWorker] Stopped.');
  }
};

module.exports = { start, stop };
