'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analytics.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// GET /api/v1/analytics/dashboard — User dashboard data
router.get('/dashboard', asyncHandler(ctrl.getUserDashboard));

// GET /api/v1/analytics/metrics — User-specific metrics over a date range
router.get('/metrics', asyncHandler(ctrl.getUserMetrics));

module.exports = router;
