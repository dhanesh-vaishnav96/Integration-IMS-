/**
 * asyncHandler.js
 * 
 * A higher-order function that wraps async route handlers/controllers.
 * This eliminates repetitive try/catch blocks in every controller.
 * 
 * Usage:
 *   router.get('/route', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 * 
 * If the async function throws, the error is forwarded to Express's
 * centralized error handler (errorMiddleware.js) via next(err).
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
