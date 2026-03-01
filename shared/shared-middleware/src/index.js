'use strict';

const { authenticate, authenticateOptional } = require('./authMiddleware');
const { rbac } = require('./rbacMiddleware');
const { tenantResolver } = require('./tenantMiddleware');
const { errorHandler, AppError } = require('./errorHandler');
const { asyncHandler } = require('./asyncHandler');
const { createRateLimiter } = require('./rateLimiter');
const { requestLogger } = require('./requestLogger');

module.exports = {
  authenticate,
  authenticateOptional,
  rbac,
  tenantResolver,
  errorHandler,
  AppError,
  asyncHandler,
  createRateLimiter,
  requestLogger,
};
