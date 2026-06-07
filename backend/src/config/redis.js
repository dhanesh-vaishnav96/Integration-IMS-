/**
 * config/redis.js
 *
 * Redis connection factory for BullMQ.
 * - Dev: connects to localhost:6379
 * - Production: uses REDIS_URL env var
 * - Fallback: in-memory mode (disabled queue, logs warning)
 */
const IORedis = require('ioredis');
const logger  = require('./logger');

let redisClient = null;
let isConnected = false;

const getRedisConnection = () => {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  const opts = { 
    maxRetriesPerRequest: null, 
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 50, 2000);
    }
  };

  try {
    if (redisUrl) {
      redisClient = new IORedis(redisUrl, opts);
    } else {
      // Dev fallback: localhost
      redisClient = new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        ...opts,
      });
    }

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('[Redis] Connected successfully');
    });

    redisClient.on('error', (err) => {
      if (isConnected) logger.error(`[Redis] Connection error: ${err.message}`);
    });

    redisClient.on('close', () => {
      isConnected = false;
      logger.warn('[Redis] Connection closed');
    });

  } catch (err) {
    logger.warn(`[Redis] Could not initialize Redis client: ${err.message}. BullMQ queues will be disabled.`);
    return null;
  }

  return redisClient;
};

const isRedisAvailable = () => isConnected;

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
  }
};

module.exports = { getRedisConnection, isRedisAvailable, disconnectRedis };
