/**
 * errorMiddleware.js (UPDATED - Uses AppError + Structured Logging)
 *
 * Two middlewares:
 *
 * 1. notFound     — Catches requests to undefined routes → 404
 * 2. errorHandler — Centralized handler for all errors thrown in the app.
 *                   Differentiates between operational (AppError) and
 *                   unexpected (programmer) errors.
 */
const AppError = require('../utils/AppError');
const logger = require('../config/logger');
const config = require('../config/env');

const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code set
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Log the error with request context
  const logContext = {
    request_id: req.requestId || 'unknown',
    method: req.method,
    url: req.originalUrl,
    statusCode: err.statusCode,
    error: err.message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (err.statusCode >= 500) {
    logger.error(`[${req.requestId}] ${err.message}`, logContext);
  } else {
    logger.warn(`[${req.requestId}] ${err.message}`, logContext);
  }

  const response = {
    success: false,
    message: err.message,
    code: err.statusCode,
    request_id: req.requestId || null,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  res.status(err.statusCode).json(response);
};

const notFound = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

module.exports = { errorHandler, notFound };
