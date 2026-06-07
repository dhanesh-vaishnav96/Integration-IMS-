/**
 * requestIdMiddleware.js
 *
 * Assigns a unique UUID v4 to every incoming request.
 * Stored in:
 *   - req.requestId              (available to all downstream middleware/controllers)
 *   - X-Request-Id response header (so clients can correlate logs)
 *
 * This is critical for distributed tracing — every log line in a request's
 * lifecycle will carry the same request_id, making debugging much easier.
 */
const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  // Honor existing request ID from upstream proxy/load balancer, or generate new one
  const requestId = req.headers['x-request-id'] || uuidv4();

  req.requestId = requestId;

  // Echo it back in the response so clients can trace the request
  res.setHeader('X-Request-Id', requestId);

  next();
};

module.exports = requestIdMiddleware;
