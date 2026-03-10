'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscription.controller');
const { authenticate, asyncHandler } = require('@nyife/shared-middleware');

// Public routes
router.get('/plans', asyncHandler(controller.listPlans));
router.get('/plans/:slug', asyncHandler(controller.getPlanBySlug));

// Authenticated routes
router.post('/subscribe', authenticate, asyncHandler(controller.subscribe));
router.post('/change-plan', authenticate, asyncHandler(controller.changePlan));
router.post('/verify-payment', authenticate, asyncHandler(controller.verifyPayment));
router.get('/current', authenticate, asyncHandler(controller.getCurrentSubscription));
router.post('/cancel', authenticate, asyncHandler(controller.cancelSubscription));
router.post('/coupons/validate', authenticate, asyncHandler(controller.validateCoupon));
router.get('/history', authenticate, asyncHandler(controller.getHistory));

// Internal routes (called by other services via internal network)
router.get('/check-limit/:userId/:resource', asyncHandler(controller.checkLimit));
router.get('/internal/active/:userId', asyncHandler(controller.getCurrentSubscriptionInternal));
router.post('/increment-usage/:userId', asyncHandler(controller.incrementUsage));

module.exports = router;
