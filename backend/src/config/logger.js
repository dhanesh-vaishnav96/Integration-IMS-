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

// ─── Log Sanitization ─────────────────────────────────────────────────────────
const maskContent = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL MASKED]')
    .replace(/AKIA[0-9A-Z]{16}/g, '[AWS_KEY MASKED]')
    .replace(/(eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,})/g, '[JWT MASKED]')
    .replace(/(Signature=|X-Amz-Signature=|client_secret=)[^&\s"']+/gi, '$1[MASKED]')
    .replace(/https:\/\/[a-zA-Z0-9.-]+\.s3\.[a-zA-Z0-9.-]+\.amazonaws\.com[^\s"']*/gi, '[PRESIGNED_URL_MASKED]')
    .replace(/"(phone|name|address)":\s*"[^"]+"/gi, '"$1":"[PII MASKED]"');
};

const sanitizeLog = winston.format((info) => {
  if (info.message && typeof info.message === 'string') {
    info.message = maskContent(info.message);
  }
  if (info.meta && typeof info.meta === 'object') {
    try {
      const metaStr = maskContent(JSON.stringify(info.meta));
      info.meta = JSON.parse(metaStr);
    } catch (e) {
      // Ignore if circular
    }
  }
  return info;
});

// Structured JSON format for production / log aggregators (Datadog, CloudWatch)
const structuredFormat = combine(
  sanitizeLog(),
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
  sanitizeLog(),
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
