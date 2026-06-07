/**
 * services/queue/sqsProducer.js
 *
 * Sends jobs to the AWS SQS queue for async processing.
 * The webhook controller calls this immediately after receiving a Graph notification.
 *
 * Message structure (MessageBody JSON):
 * {
 *   type: "PROCESS_CALL_RECORD",
 *   change_id: "...",
 *   resource: "communications/callRecords/...",
 *   resource_data: { id: "callRecordId", ... },
 *   subscription_id: "...",
 *   enqueued_at: "ISO timestamp",
 *   attempt: 1
 * }
 *
 * Deduplication:
 * We use MessageDeduplicationId = change_id for FIFO queues.
 * For standard queues, idempotency is handled in the consumer (WebhookEvent model).
 */
const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const { getSQSClient } = require('../../config/awsConfig');
const config = require('../../config/env');
const logger = require('../../config/logger');
const AppError = require('../../utils/AppError');
const { HTTP_STATUS } = require('../../constants');

const sqsProducer = {
  /**
   * enqueue()
   *
   * Sends a job message to SQS.
   * @param {Object} job - Job payload object
   * @param {number} [delaySeconds=0] - Seconds to delay delivery (0-900)
   */
  async enqueue(job, delaySeconds = 0) {
    const queueUrl = config.aws.sqsQueueUrl;

    const message = {
      ...job,
      enqueued_at: new Date().toISOString(),
      attempt: job.attempt || 1,
    };

    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: delaySeconds,
      MessageAttributes: {
        jobType: {
          DataType: 'String',
          StringValue: job.type || 'UNKNOWN',
        },
      },
    };

    // For FIFO queues, add deduplication and group IDs
    if (queueUrl.endsWith('.fifo')) {
      params.MessageDeduplicationId = job.change_id || `${Date.now()}`;
      params.MessageGroupId = job.type || 'DEFAULT';
    }

    try {
      const client = getSQSClient();
      const result = await client.send(new SendMessageCommand(params));
      logger.info(`[SQSProducer] Message enqueued | type: ${job.type} | MessageId: ${result.MessageId}`);
      return { messageId: result.MessageId };
    } catch (err) {
      logger.error(`[SQSProducer] Failed to enqueue job: ${err.message}`);
      throw new AppError(`SQS enqueue failed: ${err.message}`, HTTP_STATUS.INTERNAL_SERVER);
    }
  },

  /** Enqueue with exponential backoff delay for retries */
  async enqueueRetry(job, attemptNumber) {
    const baseDelay = Math.min(Math.pow(2, attemptNumber - 1) * 30, 900); // Max 900s
    const retryJob = { ...job, attempt: attemptNumber };
    logger.info(`[SQSProducer] Retry enqueue | attempt: ${attemptNumber} | delay: ${baseDelay}s`);
    return sqsProducer.enqueue(retryJob, baseDelay);
  },
};

module.exports = sqsProducer;
