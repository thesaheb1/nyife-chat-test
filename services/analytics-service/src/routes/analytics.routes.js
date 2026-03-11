'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analytics.controller');
const { organizationResolver, asyncHandler, rbac } = require('@nyife/shared-middleware');

router.use(organizationResolver);

// GET /api/v1/analytics/dashboard — User dashboard data
router.get('/dashboard', rbac('dashboard', 'read'), asyncHandler(ctrl.getUserDashboard));

// GET /api/v1/analytics/metrics — User-specific metrics over a date range
router.get('/metrics', rbac('analytics', 'read'), asyncHandler(ctrl.getUserMetrics));

module.exports = router;
