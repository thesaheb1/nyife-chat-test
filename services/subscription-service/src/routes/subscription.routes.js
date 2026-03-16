'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/subscription.controller');
const { authenticate, organizationResolver, asyncHandler, rbac } = require('@nyife/shared-middleware');

// Public routes
router.get('/plans', asyncHandler(controller.listPlans));
router.get('/plans/:slug', asyncHandler(controller.getPlanBySlug));

// Authenticated routes
router.post('/subscribe', authenticate, organizationResolver, rbac('subscription', 'create'), asyncHandler(controller.subscribe));
router.post('/change-plan', authenticate, organizationResolver, rbac('subscription', 'update'), asyncHandler(controller.changePlan));
router.post('/verify-payment', authenticate, organizationResolver, rbac('subscription', 'update'), asyncHandler(controller.verifyPayment));
router.get('/current', authenticate, organizationResolver, rbac('subscription', 'read'), asyncHandler(controller.getCurrentSubscription));
router.patch('/current/auto-renew', authenticate, organizationResolver, rbac('subscription', 'update'), asyncHandler(controller.updateAutoRenew));
router.post('/cancel', authenticate, organizationResolver, rbac('subscription', 'update'), asyncHandler(controller.cancelSubscription));
router.post('/coupons/validate', authenticate, organizationResolver, rbac('subscription', 'read'), asyncHandler(controller.validateCoupon));
router.get('/history', authenticate, organizationResolver, rbac('subscription', 'read'), asyncHandler(controller.getHistory));

// Internal routes (called by other services via internal network)
router.get('/check-limit/:userId/:resource', asyncHandler(controller.checkLimit));
router.get('/internal/active/:userId', asyncHandler(controller.getCurrentSubscriptionInternal));
router.post('/increment-usage/:userId', asyncHandler(controller.incrementUsage));

module.exports = router;
