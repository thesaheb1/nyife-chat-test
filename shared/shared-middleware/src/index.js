'use strict';

const { authenticate, authenticateOptional } = require('./authMiddleware');
const { rbac } = require('./rbacMiddleware');
const { tenantResolver, organizationResolver, resolveUserId } = require('./tenantMiddleware');
const { errorHandler, AppError } = require('./errorHandler');
const { asyncHandler } = require('./asyncHandler');
const { createRateLimiter } = require('./rateLimiter');
const { requestLogger } = require('./requestLogger');
const { requireActiveSubscription } = require('./subscriptionGate');

module.exports = {
  authenticate,
  authenticateOptional,
  rbac,
  tenantResolver,
  organizationResolver,
  resolveUserId,
  errorHandler,
  AppError,
  asyncHandler,
  createRateLimiter,
  requestLogger,
  requireActiveSubscription,
};
