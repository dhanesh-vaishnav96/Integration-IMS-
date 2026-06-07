/**
 * services/queue/QueueFactory.js
 *
 * Provides the appropriate IQueueService implementation
 * based on environment capabilities.
 */
const { getRedisConnection } = require('../../config/redis');
const mockQueueService = require('./mockQueueService');
const bullMQAdapter = require('./BullMQAdapter');

class QueueFactory {
  /**
   * Get the active queue service implementation.
   * @returns {import('./IQueueService')}
   */
  static getQueueService() {
    const redisConn = getRedisConnection();
    
    // Fallback logic as requested
    if (redisConn) {
      // return bullMQAdapter; // Uncomment when BullMQ is fully implemented
      return mockQueueService; // Keeping mock for now until Phase E
    }
    
    return mockQueueService;
  }
}

module.exports = QueueFactory;
