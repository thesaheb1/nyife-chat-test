'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { Plan, Coupon, Subscription, sequelize } = require('../models');
const { AppError, generateUUID, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');

const RESOURCE_MAP = {
  contacts: { used: 'contacts_used', max: 'max_contacts' },
  templates: { used: 'templates_used', max: 'max_templates' },
  campaigns: { used: 'campaigns_this_month', max: 'max_campaigns_per_month' },
  campaigns_per_month: { used: 'campaigns_this_month', max: 'max_campaigns_per_month' },
  messages: { used: 'messages_this_month', max: 'max_messages_per_month' },
  messages_per_month: { used: 'messages_this_month', max: 'max_messages_per_month' },
  team_members: { used: 'team_members_used', max: 'max_team_members' },
  organizations: { used: 'organizations_used', max: 'max_organizations' },
  whatsapp_numbers: { used: 'whatsapp_numbers_used', max: 'max_whatsapp_numbers' },
};

const RESOURCE_ALIASES = {
  campaigns_per_month: 'campaigns',
  messages_per_month: 'messages',
};

function normalizeResource(resource) {
  return RESOURCE_ALIASES[resource] || resource;
}

function calculateDates(planType) {
  const startsAt = new Date();
  let expiresAt = null;

  if (planType === 'monthly') {
    expiresAt = new Date(startsAt);
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  } else if (planType === 'yearly') {
    expiresAt = new Date(startsAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  }

  return { startsAt, expiresAt };
}

function calculateTotals(plan, discountAmount) {
  const priceAfterDiscount = Math.max(0, plan.price - discountAmount);

  let taxAmount = 0;
  if (!config.tax.inclusive) {
    taxAmount = Math.round(priceAfterDiscount * config.tax.rate / 100);
  }

  return {
    taxAmount,
    totalAmount: priceAfterDiscount + taxAmount,
  };
}

async function removePendingSubscriptions(userId) {
  await Subscription.destroy({
    where: {
      user_id: userId,
      status: 'pending',
    },
    force: true,
  });
}

async function createPendingSubscription(userId, plan, discountAmount, taxAmount, totalAmount, couponId) {
  const { startsAt, expiresAt } = calculateDates(plan.type);

  return Subscription.create({
    id: generateUUID(),
    user_id: userId,
    plan_id: plan.id,
    status: 'pending',
    starts_at: startsAt,
    expires_at: expiresAt,
    amount_paid: totalAmount,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    coupon_id: couponId,
  });
}

async function createCheckout(userId, plan, couponCode, options = {}) {
  const { couponResult = null, previousSubscriptionId = null } = options;
  const resolvedCoupon = couponResult || (couponCode
    ? await validateCouponInternal(couponCode, plan.id, userId)
    : null);
  const discountAmount = resolvedCoupon?.discount_amount || 0;
  const couponId = resolvedCoupon?.coupon_id || null;
  const { taxAmount, totalAmount } = calculateTotals(plan, discountAmount);
  const subscription = await createPendingSubscription(
    userId,
    plan,
    discountAmount,
    taxAmount,
    totalAmount,
    couponId
  );

  if (totalAmount === 0) {
    await subscription.update({ status: 'active', payment_id: 'free' });
    if (couponId) {
      await Coupon.increment('used_count', { where: { id: couponId } });
    }

    return {
      subscription,
      plan,
      payment_required: false,
      ...(previousSubscriptionId ? { previous_subscription_id: previousSubscriptionId } : {}),
    };
  }

  let razorpayOrder = null;
  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });

    razorpayOrder = await razorpay.orders.create({
      amount: totalAmount,
      currency: plan.currency || 'INR',
      receipt: `sub_${subscription.id}`,
      notes: {
        subscription_id: subscription.id,
        plan_id: plan.id,
        user_id: userId,
      },
    });
  } catch (err) {
    await subscription.destroy({ force: true });
    throw AppError.internal('Failed to create payment order. Please try again.');
  }

  return {
    subscription,
    plan,
    payment_required: true,
    razorpay_order: {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: config.razorpay.keyId,
    },
    ...(previousSubscriptionId ? { previous_subscription_id: previousSubscriptionId } : {}),
  };
}

async function listPlans() {
  return Plan.findAll({
    where: { is_active: true },
    order: [['sort_order', 'ASC'], ['price', 'ASC']],
  });
}

async function getPlanBySlug(slug) {
  const plan = await Plan.findOne({ where: { slug, is_active: true } });
  if (!plan) throw AppError.notFound('Plan not found');
  return plan;
}

async function subscribe(userId, { plan_id, coupon_code }) {
  const plan = await Plan.findByPk(plan_id);
  if (!plan || !plan.is_active) throw AppError.notFound('Plan not found or inactive');

  const existing = await Subscription.findOne({
    where: {
      user_id: userId,
      status: 'active',
    },
  });
  if (existing) {
    throw AppError.conflict('You already have an active subscription. Cancel it first or wait for it to expire.');
  }

  await removePendingSubscriptions(userId);

  return createCheckout(userId, plan, coupon_code);
}

async function changePlan(userId, { plan_id, coupon_code }) {
  const [plan, existing] = await Promise.all([
    Plan.findByPk(plan_id),
    Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active',
      },
      include: [{ model: Plan, as: 'plan' }],
    }),
  ]);

  if (!plan || !plan.is_active) throw AppError.notFound('Plan not found or inactive');
  if (!existing) throw AppError.notFound('No active subscription found');
  if (existing.plan_id === plan.id) throw AppError.badRequest('Selected plan is already active');

  await removePendingSubscriptions(userId);

  const couponResult = coupon_code
    ? await validateCouponInternal(coupon_code, plan.id, userId)
    : null;

  await existing.update({
    status: 'cancelled',
    cancelled_at: new Date(),
    cancellation_reason: 'plan_changed',
    auto_renew: false,
  });

  return createCheckout(userId, plan, coupon_code, {
    couponResult,
    previousSubscriptionId: existing.id,
  });
}

async function verifyPayment(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscription_id }) {
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw AppError.badRequest('Invalid payment signature');
  }

  const subscription = await Subscription.findOne({
    where: { id: subscription_id, user_id: userId, status: 'pending' },
    include: [{ model: Plan, as: 'plan' }],
  });

  if (!subscription) {
    throw AppError.notFound('Pending subscription not found');
  }

  await subscription.update({
    status: 'active',
    payment_id: razorpay_payment_id,
  });

  if (subscription.coupon_id) {
    await Coupon.increment('used_count', { where: { id: subscription.coupon_id } });
  }

  return subscription;
}

async function getCurrentSubscription(userId) {
  const subscription = await Subscription.findOne({
    where: {
      user_id: userId,
      status: 'active',
    },
    include: [{ model: Plan, as: 'plan' }],
    order: [['created_at', 'DESC']],
  });

  if (!subscription) {
    return null;
  }

  return subscription;
}

async function cancelSubscription(userId, reason) {
  const subscription = await Subscription.findOne({
    where: { user_id: userId, status: 'active' },
  });

  if (!subscription) {
    throw AppError.notFound('No active subscription found');
  }

  await subscription.update({
    status: 'cancelled',
    cancelled_at: new Date(),
    cancellation_reason: reason || null,
    auto_renew: false,
  });

  return subscription;
}

async function getHistory(userId, page, limit) {
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const { count, rows } = await Subscription.findAndCountAll({
    where: { user_id: userId },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'slug', 'type', 'price'] }],
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  return { subscriptions: rows, meta: getPaginationMeta(count, page, limit) };
}

async function validateCoupon(code, planId, userId) {
  const result = await validateCouponInternal(code, planId, userId);
  return result;
}

async function validateCouponInternal(code, planId, userId) {
  const coupon = await Coupon.findOne({
    where: {
      code: code.toUpperCase(),
      is_active: true,
      valid_from: { [Op.lte]: new Date() },
      [Op.or]: [
        { valid_until: null },
        { valid_until: { [Op.gte]: new Date() } },
      ],
    },
  });

  if (!coupon) {
    throw AppError.notFound('Invalid or expired coupon code');
  }

  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    throw AppError.badRequest('Coupon usage limit has been reached');
  }

  if (coupon.applicable_plan_ids && Array.isArray(coupon.applicable_plan_ids)) {
    if (!coupon.applicable_plan_ids.includes(planId)) {
      throw AppError.badRequest('Coupon is not applicable to this plan');
    }
  }

  if (coupon.applicable_user_ids && Array.isArray(coupon.applicable_user_ids)) {
    if (!coupon.applicable_user_ids.includes(userId)) {
      throw AppError.badRequest('Coupon is not applicable to your account');
    }
  }

  const plan = await Plan.findByPk(planId);
  if (!plan) throw AppError.notFound('Plan not found');

  if (coupon.min_plan_price && plan.price < coupon.min_plan_price) {
    throw AppError.badRequest('Plan price does not meet the minimum requirement for this coupon');
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = Math.round(plan.price * coupon.discount_value / 100);
  } else {
    discountAmount = coupon.discount_value;
  }
  discountAmount = Math.min(discountAmount, plan.price);

  return {
    coupon_id: coupon.id,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value,
    discount_amount: discountAmount,
    plan_price: plan.price,
    price_after_discount: plan.price - discountAmount,
  };
}

async function checkLimit(userId, resource) {
  const normalizedResource = normalizeResource(resource);
  const mapping = RESOURCE_MAP[normalizedResource];
  if (!mapping) throw AppError.badRequest(`Unknown resource: ${resource}`);

  const subscription = await Subscription.findOne({
    where: { user_id: userId, status: 'active' },
    include: [{ model: Plan, as: 'plan' }],
  });

  if (!subscription) {
    return { allowed: false, used: 0, limit: 0, message: 'No active subscription' };
  }

  const plan = subscription.plan;
  const usage = subscription.usage || {};
  const used = usage[mapping.used] || 0;
  const limit = plan[mapping.max] || 0;

  if (limit === 0) {
    return { allowed: true, used, limit: 'unlimited' };
  }

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

async function incrementUsage(userId, resource, count = 1) {
  const normalizedResource = normalizeResource(resource);
  const mapping = RESOURCE_MAP[normalizedResource];
  if (!mapping) throw AppError.badRequest(`Unknown resource: ${resource}`);

  const subscription = await Subscription.findOne({
    where: { user_id: userId, status: 'active' },
  });

  if (!subscription) {
    throw AppError.notFound('No active subscription found');
  }

  const usage = { ...subscription.usage };
  usage[mapping.used] = Math.max(0, (usage[mapping.used] || 0) + count);

  await subscription.update({ usage });

  return { resource: normalizedResource, new_count: usage[mapping.used] };
}

async function resetMonthlyUsage() {
  const [affectedCount] = await sequelize.query(
    `UPDATE sub_subscriptions
     SET usage = JSON_SET(
       usage,
       '$.campaigns_this_month', 0,
       '$.messages_this_month', 0
     ),
     updated_at = NOW()
     WHERE status = 'active'`,
    { type: sequelize.QueryTypes.UPDATE }
  );

  return { reset_count: affectedCount };
}

async function checkAndExpireSubscriptions() {
  const [affectedCount] = await Subscription.update(
    { status: 'expired' },
    {
      where: {
        status: 'active',
        expires_at: { [Op.lt]: new Date(), [Op.ne]: null },
      },
    }
  );

  return { expired_count: affectedCount };
}

module.exports = {
  listPlans,
  getPlanBySlug,
  subscribe,
  changePlan,
  verifyPayment,
  getCurrentSubscription,
  cancelSubscription,
  getHistory,
  validateCoupon,
  checkLimit,
  incrementUsage,
  resetMonthlyUsage,
  checkAndExpireSubscriptions,
};
