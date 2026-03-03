// File: server/utils/asyncHandler.js

/**
 * asyncHandler — wraps async Express route handlers and forwards any
 * rejected promise (unhandled error) to Express's next() error pipeline.
 *
 * Usage:
 *   router.get("/route", asyncHandler(async (req, res) => { ... }));
 *
 * @param {Function} fn - Async express handler (req, res, next) => Promise
 * @returns {Function}  - Standard express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
