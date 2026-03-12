'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analytics.controller');
const { asyncHandler, adminRbac } = require('@nyife/shared-middleware');

// GET /api/v1/admin/analytics/dashboard — Admin dashboard data
router.get('/dashboard', adminRbac('dashboard', 'read'), asyncHandler(ctrl.getAdminDashboard));

// GET /api/v1/admin/analytics/metrics — Admin metrics over a date range
router.get('/metrics', adminRbac('analytics', 'read'), asyncHandler(ctrl.getAdminMetrics));

module.exports = router;
