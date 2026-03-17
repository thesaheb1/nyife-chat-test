'use strict';

const { authenticate, authenticateOptional } = require('./authMiddleware');
const { adminRbac, superAdminOnly, resolveAdminActorContext } = require('./adminAuthorization');
const { rbac } = require('./rbacMiddleware');
const { tenantResolver, organizationResolver, organizationParamResolver, resolveUserId } = require('./tenantMiddleware');
const { errorHandler, AppError } = require('./errorHandler');
const { asyncHandler } = require('./asyncHandler');
const { createRateLimiter } = require('./rateLimiter');
const { requestLogger } = require('./requestLogger');
const { requireActiveSubscription } = require('./subscriptionGate');

module.exports = {
  authenticate,
  authenticateOptional,
  adminRbac,
  superAdminOnly,
  resolveAdminActorContext,
  rbac,
  tenantResolver,
  organizationResolver,
  organizationParamResolver,
  resolveUserId,
  errorHandler,
  AppError,
  asyncHandler,
  createRateLimiter,
  requestLogger,
  requireActiveSubscription,
};
