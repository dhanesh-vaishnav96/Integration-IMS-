/**
 * helpers/responseHelper.js
 *
 * Standardizes API response format across ALL endpoints.
 * Every API in this project MUST use these helpers to ensure
 * consistent response envelopes for the frontend and consumers.
 *
 * Envelope format (success):
 * {
 *   "success": true,
 *   "message": "Interview scheduled",
 *   "data": { ... }
 * }
 *
 * Envelope format (error — handled by errorMiddleware):
 * {
 *   "success": false,
 *   "message": "Candidate not found",
 *   "code": 404
 * }
 */

/**
 * Send a success response.
 * @param {Response} res - Express response object
 * @param {string} message - Human-readable success message
 * @param {*} data - Response payload
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, message, data = null, statusCode = 200) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
  };
  return res.status(statusCode).json(response);
};

/**
 * Send a created response (201).
 */
const sendCreated = (res, message, data = null) => {
  return sendSuccess(res, message, data, 201);
};

/**
 * Send a no-content response (204).
 */
const sendNoContent = (res) => {
  return res.status(204).send();
};

module.exports = { sendSuccess, sendCreated, sendNoContent };
