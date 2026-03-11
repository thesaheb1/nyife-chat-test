'use strict';

const analyticsService = require('../services/analytics.service');
const { successResponse } = require('@nyife/shared-utils');
const { AppError } = require('@nyife/shared-middleware');
const {
  dashboardQuerySchema,
  adminDashboardQuerySchema,
  metricsQuerySchema,
} = require('../validations/analytics.validation');

// ──────────────────────────────────────────────────────────────────────────────
// User endpoints
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/analytics/dashboard
 * Returns aggregated dashboard data for the authenticated user.
 */
async function getUserDashboard(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const filters = dashboardQuerySchema.parse(req.query);
  const { sequelize, redis } = req.app.locals;

  const data = await analyticsService.getUserDashboard(userId, filters, sequelize, redis);

  return successResponse(res, data, 'Dashboard data retrieved successfully');
}

/**
 * GET /api/v1/analytics/metrics
 * Returns specific metrics for the authenticated user over a date range.
 */
async function getUserMetrics(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  if (!userId) {
    throw new AppError('Authentication required', 401);
  }

  const params = metricsQuerySchema.parse(req.query);
  params.user_id = userId; // scope to authenticated user

  const { sequelize } = req.app.locals;
  const data = await analyticsService.getMetrics(params, sequelize);

  return successResponse(res, data, 'Metrics retrieved successfully');
}

// ──────────────────────────────────────────────────────────────────────────────
// Admin endpoints
// ──────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/analytics/dashboard
 * Returns aggregated dashboard data for the admin panel.
 */
async function getAdminDashboard(req, res) {
  const filters = adminDashboardQuerySchema.parse(req.query);
  const { sequelize, redis } = req.app.locals;

  const data = await analyticsService.getAdminDashboard(filters, sequelize, redis);

  return successResponse(res, data, 'Admin dashboard data retrieved successfully');
}

/**
 * GET /api/v1/admin/analytics/metrics
 * Returns specific metrics for admin, optionally scoped to a user.
 */
async function getAdminMetrics(req, res) {
  const params = metricsQuerySchema.parse(req.query);
  const { sequelize } = req.app.locals;

  const data = await analyticsService.getMetrics(params, sequelize);

  return successResponse(res, data, 'Admin metrics retrieved successfully');
}

module.exports = {
  getUserDashboard,
  getUserMetrics,
  getAdminDashboard,
  getAdminMetrics,
};
