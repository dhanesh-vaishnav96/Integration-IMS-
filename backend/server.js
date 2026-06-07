/**
 * server.js — Updated with Socket.IO + BullMQ + Redis
 */
require('dotenv').config();
const http          = require('http');
const { Server }    = require('socket.io');
const app           = require('./src/app');
const config        = require('./src/config/env');
const connectDB     = require('./src/config/db');
const logger        = require('./src/config/logger');
const validateConfig = require('./src/config/configValidator');
const { provider }  = require('./src/config/databaseProvider');
const { getRedisConnection, disconnectRedis } = require('./src/config/redis');

// Services
const WebSocketService       = require('./src/services/scheduling/WebSocketService');
const { initQueues }         = require('./src/jobs/bullmq/schedulingQueue');
const { startWorkers, stopWorkers } = require('./src/jobs/bullmq/schedulingWorkers');

// Background jobs
const sqsWorker              = require('./src/jobs/sqsWorker');
const subscriptionRenewalJob = require('./src/jobs/subscriptionRenewalJob');

// ─── Step 1: Validate Config ────────────────────────────────────────────────
validateConfig();

// ─── Step 2: Connect to Database ─────────────────────────────────────────────
connectDB();

// ─── Step 3: Create HTTP + Socket.IO server ──────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Inject io into WebSocketService
WebSocketService.init(io);

// ─── Step 4: Start HTTP Server ──────────────────────────────────────────────
httpServer.listen(config.port, () => {
  logger.info(`🚀 Server is running in [${config.env}] mode on port ${config.port}`);
  logger.info(`📡 Health Check: http://localhost:${config.port}/api/v1/health`);
  logger.info(`📅 Scheduling: http://localhost:${config.port}/api/v1/scheduling/calendar`);
  logger.info(`🖳️  Database Provider: ${provider.toUpperCase()}`);
  logger.info(`🔌 WebSocket: ws://localhost:${config.port}`);

  if (config.env !== 'test') {
    // Initialize Redis + BullMQ (graceful if Redis unavailable)
    const redisConn = getRedisConnection();
    if (redisConn) {
      initQueues();
      startWorkers();
      logger.info('📦 BullMQ queues + workers started');
    } else {
      logger.warn('⚠️  Redis unavailable — BullMQ queues disabled (in-memory fallback)');
    }

    // Existing background jobs
    sqsWorker.start();
    subscriptionRenewalJob.start();
  }
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  sqsWorker.stop();
  subscriptionRenewalJob.stop();
  await stopWorkers();
  await disconnectRedis();

  io.close();
  httpServer.close(async () => {
    logger.info('HTTP server closed. Closing database connection...');
    try {
      if (provider === 'postgres') {
        const { disconnectPrisma } = require('./src/config/prisma');
        await disconnectPrisma();
      } else {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        logger.info('MongoDB connection closed.');
      }
      logger.info('Process exiting cleanly.');
      process.exit(0);
    } catch (err) {
      logger.error(`Error during database disconnect: ${err.message}`);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  shutdown('uncaughtException');
});
