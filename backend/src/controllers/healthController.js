/**
 * healthController.js
 *
 * Provider-aware health check.
 * Returns DB status for either Prisma (PostgreSQL) or Mongoose (MongoDB).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../helpers/responseHelper');
const config = require('../config/env');
const logger = require('../config/logger');
const { provider } = require('../config/databaseProvider');
const { version } = require('../../package.json');

const checkHealth = asyncHandler(async (req, res) => {
  let dbStatus = 'unknown';
  let dbName   = 'N/A';
  let isUp     = false;

  if (provider === 'postgres') {
    try {
      const { prisma } = require('../config/prisma');
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
      dbName   = 'PostgreSQL (RDS)';
      isUp     = true;
    } catch (err) {
      dbStatus = 'disconnected';
      dbName   = 'PostgreSQL (RDS)';
      logger.warn(`[Health] PostgreSQL ping failed: ${err.message}`);
    }
  } else {
    const mongoose = require('mongoose');
    const states   = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    const state    = mongoose.connection.readyState;
    dbStatus = states[state] || 'unknown';
    dbName   = mongoose.connection.name || 'MongoDB';
    isUp     = state === 1;
  }

  const health = {
    status: isUp ? 'UP' : 'DEGRADED',
    database: { status: dbStatus, name: dbName, provider },
    uptime: {
      seconds: Math.floor(process.uptime()),
      human:   formatUptime(process.uptime()),
    },
    environment: config.env,
    version,
    timestamp: new Date().toISOString(),
  };

  const httpStatus = isUp ? 200 : 503;
  logger.info(`Health check: ${health.status} | DB: ${dbStatus}`);
  res.status(httpStatus).json({ success: true, data: health });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = { checkHealth };
