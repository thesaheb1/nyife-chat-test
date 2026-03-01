'use strict';

const subscriptionService = require('../services/subscription.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  subscribeSchema,
  verifyPaymentSchema,
  cancelSchema,
  validateCouponSchema,
  checkLimitParamsSchema,
  incrementUsageSchema,
  paginationSchema,
} = require('../validations/subscription.validation');

async function listPlans(_req, res) {
  const plans = await subscriptionService.listPlans();
  return successResponse(res, { plans }, 'Plans retrieved successfully');
}

async function getPlanBySlug(req, res) {
  const plan = await subscriptionService.getPlanBySlug(req.params.slug);
  return successResponse(res, { plan }, 'Plan retrieved successfully');
}

async function subscribe(req, res) {
  const data = subscribeSchema.parse(req.body);
  const result = await subscriptionService.subscribe(req.user.id, data);
  return successResponse(res, result, result.payment_required ? 'Payment order created' : 'Subscription activated', 201);
}

async function verifyPayment(req, res) {
  const data = verifyPaymentSchema.parse(req.body);
  const subscription = await subscriptionService.verifyPayment(req.user.id, data);
  return successResponse(res, { subscription }, 'Payment verified and subscription activated');
}

async function getCurrentSubscription(req, res) {
  const subscription = await subscriptionService.getCurrentSubscription(req.user.id);
  return successResponse(res, { subscription }, subscription ? 'Current subscription retrieved' : 'No active subscription');
}

async function cancelSubscription(req, res) {
  const { reason } = cancelSchema.parse(req.body);
  const subscription = await subscriptionService.cancelSubscription(req.user.id, reason);
  return successResponse(res, { subscription }, 'Subscription cancelled successfully');
}

async function validateCoupon(req, res) {
  const { code, plan_id } = validateCouponSchema.parse(req.body);
  const result = await subscriptionService.validateCoupon(code, plan_id, req.user.id);
  return successResponse(res, result, 'Coupon is valid');
}

async function getHistory(req, res) {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await subscriptionService.getHistory(req.user.id, page, limit);
  return successResponse(res, { subscriptions: result.subscriptions }, 'Subscription history retrieved', 200, result.meta);
}

// Internal endpoints (service-to-service)
async function checkLimit(req, res) {
  const { userId, resource } = checkLimitParamsSchema.parse(req.params);
  const result = await subscriptionService.checkLimit(userId, resource);
  return successResponse(res, result, 'Limit check completed');
}

async function incrementUsage(req, res) {
  const { userId } = req.params;
  const { resource, count } = incrementUsageSchema.parse(req.body);
  const result = await subscriptionService.incrementUsage(userId, resource, count);
  return successResponse(res, result, 'Usage incremented');
}

module.exports = {
  listPlans,
  getPlanBySlug,
  subscribe,
  verifyPayment,
  getCurrentSubscription,
  cancelSubscription,
  validateCoupon,
  getHistory,
  checkLimit,
  incrementUsage,
};
