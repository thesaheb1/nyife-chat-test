'use strict';

/**
 * Wraps an async Express route handler to automatically catch rejected promises
 * and forward them to the Express error-handling middleware via next(err).
 *
 * Without this wrapper, unhandled promise rejections in async route handlers
 * would cause the request to hang indefinitely instead of returning an error response.
 *
 * @param {Function} fn - An async Express route handler function (req, res, next) => Promise<void>
 * @returns {Function} An Express middleware that catches promise rejections and calls next(err)
 *
 * @example
 * const { asyncHandler } = require('@nyife/shared-middleware');
 *
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await UserService.findAll();
 *   res.json({ success: true, data: users });
 * }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  asyncHandler,
};
