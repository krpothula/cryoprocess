/**
 * Async Handler Utility
 *
 * Wraps async route handlers to catch errors and pass them to Express error handler.
 * Eliminates the need for try-catch in every async controller function.
 */

/**
 * Wrap an async function to catch errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches errors
 *
 * @example
 * // In routes:
 * router.get('/users', asyncHandler(userController.list));
 *
 * // Instead of:
 * router.get('/users', async (req, res, next) => {
 *   try {
 *     await userController.list(req, res);
 *   } catch (error) {
 *     next(error);
 *   }
 * });
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;
