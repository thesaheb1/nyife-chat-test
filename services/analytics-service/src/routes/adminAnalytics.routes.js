'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analytics.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// GET /api/v1/admin/analytics/dashboard — Admin dashboard data
router.get('/dashboard', asyncHandler(ctrl.getAdminDashboard));

// GET /api/v1/admin/analytics/metrics — Admin metrics over a date range
router.get('/metrics', asyncHandler(ctrl.getAdminMetrics));

module.exports = router;
