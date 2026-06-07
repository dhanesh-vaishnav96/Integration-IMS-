/**
 * logger.js (UPDATED - Structured Logging)
 *
 * Winston-based structured logger.
 *
 * Log format includes:
 *   - timestamp       : ISO timestamp
 *   - level           : Log severity (info, warn, error, debug)
 *   - service         : Fixed service identifier
 *   - request_id      : Per-request UUID (set via logger.child())
 *   - message         : Human-readable log message
 *
 * Usage in controllers (with request context):
 *   const reqLogger = req.logger; // Set by requestIdMiddleware
 *   reqLogger.info('Processing interview webhook');
 *
 * Usage without request context (e.g., startup, workers):
 *   const logger = require('./logger');
 *   logger.info('Worker started');
 */
const winston = require('winston');
const config = require('./env');

const { combine, timestamp, printf, colorize, uncolorize, errors } = winston.format;

// Structured JSON format for production / log aggregators (Datadog, CloudWatch)
const structuredFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.sssZ' }),
  printf(({ level, message, timestamp, service, request_id, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      service: service || 'interview-management-backend',
      request_id: request_id || 'system',
      message,
      ...(stack && { stack }),
      ...(Object.keys(meta).length > 0 && { meta }),
    };
    return JSON.stringify(logEntry);
  })
);

// Human-readable format for development terminal
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp, request_id }) =>
    `${timestamp} [${level}] ${request_id ? `[${request_id}]` : ''} ${message}`
  )
);

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  defaultMeta: { service: 'interview-management-backend' },
  format: config.env === 'development' ? devFormat : structuredFormat,
  transports: [
    new winston.transports.Console(),
  ],
  // In production, add file/CloudWatch transports here
  // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  // new winston.transports.File({ filename: 'logs/combined.log' }),
});

module.exports = logger;
