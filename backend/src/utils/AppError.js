/**
 * AppError.js
 * 
 * A custom error class extending JavaScript's native Error.
 * Allows us to throw structured errors with HTTP status codes
 * from anywhere in the application.
 *
 * Usage:
 *   throw new AppError('Candidate not found', 404);
 *   throw new AppError('Unauthorized access', 401);
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Marks error as an expected operational error

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
