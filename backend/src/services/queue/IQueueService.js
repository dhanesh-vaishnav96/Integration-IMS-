/**
 * services/queue/IQueueService.js
 *
 * Interface for Queue Service implementations.
 * This guarantees a consistent contract whether using Mock, BullMQ, or SQS.
 */

class IQueueService {
  /**
   * Enqueue a job into the queue.
   * @param {string} queueName 
   * @param {string} jobName 
   * @param {Object} payload 
   * @param {Object} [options] 
   * @returns {Promise<{ id: string }>}
   */
  async enqueue(queueName, jobName, payload, options = {}) {
    throw new Error('Method enqueue() must be implemented.');
  }

  /**
   * Process a job directly (or define processing logic).
   * @param {string} queueName 
   * @param {string} jobName 
   * @param {Object} payload 
   */
  async process(queueName, jobName, payload) {
    throw new Error('Method process() must be implemented.');
  }

  /**
   * Retry a failed job.
   * @param {string} queueName 
   * @param {string} jobId 
   */
  async retry(queueName, jobId) {
    throw new Error('Method retry() must be implemented.');
  }

  /**
   * Get the status of a job.
   * @param {string} queueName 
   * @param {string} jobId 
   * @returns {Promise<string>} 'PENDING' | 'PROCESSING' | 'UPLOADED' | 'FAILED' | 'RETRYING'
   */
  async getStatus(queueName, jobId) {
    throw new Error('Method getStatus() must be implemented.');
  }

  /**
   * Mark a job as failed manually.
   * @param {string} queueName 
   * @param {string} jobId 
   * @param {Error} error 
   */
  async markFailed(queueName, jobId, error) {
    throw new Error('Method markFailed() must be implemented.');
  }
}

module.exports = IQueueService;
