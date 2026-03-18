'use strict';

const { z } = require('zod');

const subscribeSchema = z.object({
  plan_id: z.string().uuid('Invalid plan ID'),
  coupon_code: z.string().max(50).optional(),
});

const changePlanSchema = subscribeSchema;

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
  subscription_id: z.string().uuid('Invalid subscription ID'),
});

const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

const autoRenewSchema = z.object({
  enabled: z.boolean(),
});

const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(50),
  plan_id: z.string().uuid('Invalid plan ID'),
});

const checkLimitParamsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  resource: z.enum([
    'contacts',
    'templates',
    'campaigns',
    'campaigns_per_month',
    'messages',
    'messages_per_month',
    'team_members',
    'organizations',
    'whatsapp_numbers',
  ]),
});

const internalSubscriptionParamsSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

const incrementUsageSchema = z.object({
  resource: z.enum([
    'contacts',
    'templates',
    'campaigns',
    'campaigns_per_month',
    'messages',
    'messages_per_month',
    'team_members',
    'organizations',
    'whatsapp_numbers',
  ]),
  count: z.number().int().refine((value) => value !== 0, 'Count must not be zero').default(1),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  subscribeSchema,
  changePlanSchema,
  verifyPaymentSchema,
  cancelSchema,
  autoRenewSchema,
  validateCouponSchema,
  checkLimitParamsSchema,
  internalSubscriptionParamsSchema,
  incrementUsageSchema,
  paginationSchema,
};
