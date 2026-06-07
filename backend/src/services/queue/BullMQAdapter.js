/**
 * services/queue/BullMQAdapter.js
 *
 * BullMQ implementation of the IQueueService interface.
 * Placeholder for Phase E/F implementation.
 */
const IQueueService = require('./IQueueService');

class BullMQAdapter extends IQueueService {
  constructor() {
    super();
    // this.queue = new Queue(...)
  }

  async enqueue(queueName, jobName, payload, options = {}) {
    // throw new Error('Not implemented: requires Redis');
  }

  async process(queueName, jobName, payload) {
    // throw new Error('Not implemented: requires Redis');
  }

  async retry(queueName, jobId) {
    // throw new Error('Not implemented: requires Redis');
  }

  async getStatus(queueName, jobId) {
    // throw new Error('Not implemented: requires Redis');
  }

  async markFailed(queueName, jobId, error) {
    // throw new Error('Not implemented: requires Redis');
  }
}

module.exports = new BullMQAdapter();
