'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Plan,
  Coupon,
  Subscription,
  SubscriptionRenewalAttempt,
  sequelize,
} = require('../models');
const {
  AppError,
  generateUUID,
  getPagination,
  getPaginationMeta,
} = require('@nyife/shared-utils');
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

const PAYMENT_METHODS = {
  FREE: 'free',
  WALLET: 'wallet',
  RAZORPAY: 'razorpay',
};

const RENEWAL_STATES = {
  SCHEDULED: 'scheduled',
  DISABLED: 'disabled',
  INELIGIBLE: 'ineligible',
  GRACE_PERIOD: 'grace_period',
  FAILED: 'failed',
  RENEWED: 'renewed',
};

const CHECKOUT_TYPES = {
  PURCHASE: 'purchase',
  CHANGE_PLAN: 'change_plan',
  RENEWAL: 'renewal',
};

const DEFAULT_USAGE = {
  contacts_used: 0,
  templates_used: 0,
  campaigns_this_month: 0,
  messages_this_month: 0,
  team_members_used: 0,
  organizations_used: 0,
  whatsapp_numbers_used: 0,
};

function normalizeResource(resource) {
  return RESOURCE_ALIASES[resource] || resource;
}

function isAutoRenewEligiblePlan(plan) {
  return ['monthly', 'yearly'].includes(String(plan?.type || '').toLowerCase());
}

function calculateDates(planType, anchorDate = new Date()) {
  const startsAt = new Date(anchorDate);
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
  const priceAfterDiscount = Math.max(0, Number(plan.price || 0) - Number(discountAmount || 0));

  let taxAmount = 0;
  if (!config.tax.inclusive) {
    taxAmount = Math.round(priceAfterDiscount * config.tax.rate / 100);
  }

  return {
    taxAmount,
    totalAmount: priceAfterDiscount + taxAmount,
  };
}

function getSubscriptionRenewalState(subscription) {
  if (!subscription) {
    return null;
  }

  const eligible = isAutoRenewEligiblePlan(subscription.plan);
  if (subscription.renewal_state) {
    return subscription.renewal_state;
  }

  if (!eligible) {
    return RENEWAL_STATES.INELIGIBLE;
  }

  return subscription.auto_renew ? RENEWAL_STATES.SCHEDULED : RENEWAL_STATES.DISABLED;
}

function serializeSubscriptionRecord(subscription) {
  if (!subscription) {
    return null;
  }

  const plain = typeof subscription.toJSON === 'function' ? subscription.toJSON() : { ...subscription };
  const eligible = isAutoRenewEligiblePlan(plain.plan);

  return {
    ...plain,
    auto_renew_eligible: eligible,
    next_billing_at: plain.expires_at,
    renewal_state: getSubscriptionRenewalState(plain),
  };
}

function buildCheckoutResponse(subscription, plan, options = {}) {
  const {
    paymentRequired = false,
    paymentMethod = null,
    walletDebitedAmount = 0,
    walletBalanceAfter = null,
    razorpayOrder = null,
    previousSubscriptionId = null,
  } = options;

  return {
    subscription: serializeSubscriptionRecord(subscription),
    plan: typeof plan?.toJSON === 'function' ? plan.toJSON() : plan,
    payment_required: paymentRequired,
    payment_method: paymentMethod,
    wallet_debited_amount: walletDebitedAmount,
    wallet_balance_after: walletBalanceAfter,
    auto_renew_eligible: isAutoRenewEligiblePlan(plan),
    ...(razorpayOrder ? { razorpay_order: razorpayOrder } : {}),
    ...(previousSubscriptionId ? { previous_subscription_id: previousSubscriptionId } : {}),
  };
}

function mapServiceError(status, message) {
  if (status === 400) {
    return AppError.badRequest(message);
  }
  if (status === 403) {
    return AppError.forbidden(message);
  }
  if (status === 404) {
    return AppError.notFound(message);
  }
  if (status === 409) {
    return AppError.conflict(message);
  }
  return AppError.internal(message);
}

async function fetchJson(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const message = payload?.message || payload?.error || `Request failed with status ${response.status}`;
      throw mapServiceError(response.status, message);
    }

    return payload;
  } catch (err) {
    if (err instanceof AppError || err?.isOperational) {
      throw err;
    }

    if (err?.name === 'AbortError') {
      throw AppError.internal('A dependent billing service timed out. Please try again.');
    }

    throw AppError.internal('A dependent billing service is unavailable right now. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}

async function getWalletBalance(userId) {
  const payload = await fetchJson(
    `${config.walletServiceUrl}/api/v1/wallet/balance/${encodeURIComponent(userId)}`
  );

  return payload?.data || payload;
}

async function debitWalletForSubscription(userId, amount, subscription, checkoutType, idempotencyKey) {
  const planName = subscription.plan?.name || 'subscription';
  const descriptionMap = {
    [CHECKOUT_TYPES.PURCHASE]: `Subscription purchase for ${planName}`,
    [CHECKOUT_TYPES.CHANGE_PLAN]: `Plan change charge for ${planName}`,
    [CHECKOUT_TYPES.RENEWAL]: `Auto-pay renewal for ${planName}`,
  };

  const payload = await fetchJson(
    `${config.walletServiceUrl}/api/v1/wallet/debit`,
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        amount,
        source: 'subscription_payment',
        reference_type: 'subscription',
        reference_id: subscription.id,
        idempotency_key: idempotencyKey,
        description: descriptionMap[checkoutType] || `Subscription payment for ${planName}`,
        meta: {
          kind: checkoutType,
          subscription_id: subscription.id,
          plan_id: subscription.plan_id,
          replaces_subscription_id: subscription.replaces_subscription_id || null,
        },
      }),
    }
  );

  return payload?.data || payload;
}

function createIdempotencyKey(prefix, payload) {
  const hash = crypto.createHash('sha256').update(String(payload)).digest('hex');
  return `${prefix}_${hash}`.slice(0, 191);
}

function buildCheckoutWalletKey(subscriptionId) {
  return createIdempotencyKey('subchk', subscriptionId);
}

function buildRenewalWalletKey(subscriptionId, cycleAnchorAt, attemptNumber) {
  return createIdempotencyKey('subren', `${subscriptionId}:${new Date(cycleAnchorAt).toISOString()}:${attemptNumber}`);
}

function getGraceExpiryDate(subscription) {
  if (subscription.grace_expires_at) {
    return new Date(subscription.grace_expires_at);
  }

  if (!subscription.expires_at) {
    return null;
  }

  return new Date(new Date(subscription.expires_at).getTime() + config.renewal.gracePeriodMs);
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

async function createPendingSubscription(userId, plan, options) {
  const {
    discountAmount,
    taxAmount,
    totalAmount,
    couponId = null,
    paymentMethod = null,
    replacesSubscriptionId = null,
    startsAt = null,
  } = options;
  const dates = calculateDates(plan.type, startsAt || new Date());

  return Subscription.create({
    id: generateUUID(),
    user_id: userId,
    plan_id: plan.id,
    status: 'pending',
    starts_at: dates.startsAt,
    expires_at: dates.expiresAt,
    amount_paid: totalAmount,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    coupon_id: couponId,
    auto_renew: false,
    payment_method: paymentMethod,
    renewal_state: isAutoRenewEligiblePlan(plan) ? RENEWAL_STATES.DISABLED : RENEWAL_STATES.INELIGIBLE,
    replaces_subscription_id: replacesSubscriptionId,
  });
}

async function loadSubscriptionWithPlanById(subscriptionId, transaction = null, lock = false) {
  return Subscription.findOne({
    where: { id: subscriptionId },
    include: [{ model: Plan, as: 'plan' }],
    transaction: transaction || undefined,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

async function incrementCouponUsage(couponId, transaction = null) {
  if (!couponId) {
    return;
  }

  await Coupon.increment('used_count', {
    where: { id: couponId },
    paranoid: false,
    transaction: transaction || undefined,
  });
}

async function activateCheckoutSubscription(subscriptionId, options) {
  const {
    paymentMethod,
    paymentId,
    autoRenew = false,
  } = options;

  return sequelize.transaction(async (transaction) => {
    const subscription = await loadSubscriptionWithPlanById(subscriptionId, transaction, true);
    if (!subscription) {
      throw AppError.notFound('Pending subscription not found');
    }

    if (subscription.status === 'active') {
      return subscription;
    }

    if (subscription.status !== 'pending') {
      throw AppError.badRequest('Subscription is no longer pending');
    }

    if (subscription.replaces_subscription_id) {
      const previousSubscription = await Subscription.findByPk(subscription.replaces_subscription_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (previousSubscription?.status === 'active') {
        await previousSubscription.update({
          status: 'cancelled',
          cancelled_at: new Date(),
          cancellation_reason: 'plan_changed',
          auto_renew: false,
          renewal_state: RENEWAL_STATES.DISABLED,
        }, { transaction });
      }
    }

    const nextAutoRenew = isAutoRenewEligiblePlan(subscription.plan) ? Boolean(autoRenew) : false;

    await subscription.update({
      status: 'active',
      payment_id: paymentId || null,
      payment_method: paymentMethod,
      auto_renew: nextAutoRenew,
      renewal_state: nextAutoRenew ? RENEWAL_STATES.SCHEDULED : (
        isAutoRenewEligiblePlan(subscription.plan) ? RENEWAL_STATES.DISABLED : RENEWAL_STATES.INELIGIBLE
      ),
      grace_expires_at: null,
      next_renewal_attempt_at: null,
      renewal_attempt_count: 0,
      last_renewal_error: null,
    }, { transaction });

    await incrementCouponUsage(subscription.coupon_id, transaction);

    return subscription;
  });
}

async function createRazorpayOrderForSubscription(subscription, plan) {
  let razorpayOrder = null;

  try {
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });

    razorpayOrder = await razorpay.orders.create({
      amount: subscription.amount_paid,
      currency: plan.currency || 'INR',
      receipt: `sub_${subscription.id}`,
      notes: {
        subscription_id: subscription.id,
        plan_id: plan.id,
        user_id: subscription.user_id,
      },
    });
  } catch (err) {
    await subscription.destroy({ force: true });
    throw AppError.internal('Failed to create payment order. Please try again.');
  }

  return buildCheckoutResponse(subscription, plan, {
    paymentRequired: true,
    paymentMethod: PAYMENT_METHODS.RAZORPAY,
    razorpayOrder: {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: config.razorpay.keyId,
    },
    previousSubscriptionId: subscription.replaces_subscription_id || null,
  });
}

async function finalizeWalletPendingSubscription(subscription, checkoutType, options = {}) {
  const { allowRazorpayFallback = false } = options;
  const idempotencyKey = buildCheckoutWalletKey(subscription.id);

  try {
    const debitResult = await debitWalletForSubscription(
      subscription.user_id,
      subscription.amount_paid,
      subscription,
      checkoutType,
      idempotencyKey
    );

    const activatedSubscription = await activateCheckoutSubscription(subscription.id, {
      paymentMethod: PAYMENT_METHODS.WALLET,
      paymentId: debitResult.transaction_id,
      autoRenew: false,
    });

    return buildCheckoutResponse(activatedSubscription, activatedSubscription.plan, {
      paymentRequired: false,
      paymentMethod: PAYMENT_METHODS.WALLET,
      walletDebitedAmount: subscription.amount_paid,
      walletBalanceAfter: debitResult.balance_after,
      previousSubscriptionId: activatedSubscription.replaces_subscription_id || null,
    });
  } catch (err) {
    if (
      allowRazorpayFallback &&
      err?.statusCode === 400 &&
      String(err.message || '').toLowerCase().includes('insufficient wallet balance')
    ) {
      await subscription.update({ payment_method: PAYMENT_METHODS.RAZORPAY });
      return createRazorpayOrderForSubscription(subscription, subscription.plan);
    }

    throw err;
  }
}

async function resumePendingWalletCheckout(userId) {
  const pendingWalletCheckout = await Subscription.findOne({
    where: {
      user_id: userId,
      status: 'pending',
      payment_method: PAYMENT_METHODS.WALLET,
    },
    include: [{ model: Plan, as: 'plan' }],
    order: [['created_at', 'DESC']],
  });

  if (!pendingWalletCheckout) {
    return null;
  }

  return finalizeWalletPendingSubscription(
    pendingWalletCheckout,
    pendingWalletCheckout.replaces_subscription_id ? CHECKOUT_TYPES.CHANGE_PLAN : CHECKOUT_TYPES.PURCHASE,
    { allowRazorpayFallback: false }
  );
}

async function createCheckout(userId, plan, couponCode, options = {}) {
  const {
    replacesSubscriptionId = null,
    startsAt = null,
  } = options;

  const resolvedCoupon = couponCode
    ? await validateCouponInternal(couponCode, plan.id, userId)
    : null;
  const discountAmount = resolvedCoupon?.discount_amount || 0;
  const couponId = resolvedCoupon?.coupon_id || null;
  const { taxAmount, totalAmount } = calculateTotals(plan, discountAmount);
  const checkoutType = replacesSubscriptionId ? CHECKOUT_TYPES.CHANGE_PLAN : CHECKOUT_TYPES.PURCHASE;

  if (totalAmount === 0) {
    const pendingSubscription = await createPendingSubscription(userId, plan, {
      discountAmount,
      taxAmount,
      totalAmount,
      couponId,
      paymentMethod: PAYMENT_METHODS.FREE,
      replacesSubscriptionId,
      startsAt,
    });

    const activatedSubscription = await activateCheckoutSubscription(pendingSubscription.id, {
      paymentMethod: PAYMENT_METHODS.FREE,
      paymentId: 'free',
      autoRenew: false,
    });

    return buildCheckoutResponse(activatedSubscription, plan, {
      paymentRequired: false,
      paymentMethod: PAYMENT_METHODS.FREE,
      previousSubscriptionId: replacesSubscriptionId,
    });
  }

  let walletCanCover = false;
  try {
    const wallet = await getWalletBalance(userId);
    walletCanCover = Number(wallet?.balance || 0) >= totalAmount;
  } catch (err) {
    console.warn('[subscription-service] Wallet balance check failed, continuing with Razorpay:', err.message);
  }

  const pendingSubscription = await createPendingSubscription(userId, plan, {
    discountAmount,
    taxAmount,
    totalAmount,
    couponId,
    paymentMethod: walletCanCover ? PAYMENT_METHODS.WALLET : PAYMENT_METHODS.RAZORPAY,
    replacesSubscriptionId,
    startsAt,
  });

  const pendingWithPlan = await loadSubscriptionWithPlanById(pendingSubscription.id);

  if (walletCanCover) {
    return finalizeWalletPendingSubscription(pendingWithPlan, checkoutType, {
      allowRazorpayFallback: true,
    });
  }

  return createRazorpayOrderForSubscription(pendingWithPlan, plan);
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

  const resumedCheckout = await resumePendingWalletCheckout(userId);
  if (resumedCheckout) {
    return resumedCheckout;
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

  const resumedCheckout = await resumePendingWalletCheckout(userId);
  if (resumedCheckout) {
    return resumedCheckout;
  }

  await removePendingSubscriptions(userId);

  return createCheckout(userId, plan, coupon_code, {
    replacesSubscriptionId: existing.id,
  });
}

async function verifyPayment(userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscription_id }) {
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest();

  const providedSignature = Buffer.from(String(razorpay_signature || ''), 'utf8');
  const expectedHex = Buffer.from(expectedSignature.toString('hex'), 'utf8');

  if (providedSignature.length !== expectedHex.length || !crypto.timingSafeEqual(expectedHex, providedSignature)) {
    throw AppError.badRequest('Invalid payment signature');
  }

  const subscription = await Subscription.findOne({
    where: { id: subscription_id, user_id: userId },
    include: [{ model: Plan, as: 'plan' }],
  });

  if (!subscription) {
    throw AppError.notFound('Pending subscription not found');
  }

  if (subscription.status === 'active' && subscription.payment_method === PAYMENT_METHODS.RAZORPAY) {
    return serializeSubscriptionRecord(subscription);
  }

  if (subscription.status !== 'pending') {
    throw AppError.badRequest('Subscription is no longer awaiting payment');
  }

  const activatedSubscription = await activateCheckoutSubscription(subscription.id, {
    paymentMethod: PAYMENT_METHODS.RAZORPAY,
    paymentId: razorpay_payment_id,
    autoRenew: false,
  });

  return serializeSubscriptionRecord(activatedSubscription);
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

  return serializeSubscriptionRecord(subscription);
}

async function cancelSubscription(userId, reason) {
  const subscription = await Subscription.findOne({
    where: { user_id: userId, status: 'active' },
    include: [{ model: Plan, as: 'plan' }],
  });

  if (!subscription) {
    throw AppError.notFound('No active subscription found');
  }

  await subscription.update({
    status: 'cancelled',
    cancelled_at: new Date(),
    cancellation_reason: reason || null,
    auto_renew: false,
    renewal_state: isAutoRenewEligiblePlan({ type: subscription.plan?.type }) ? RENEWAL_STATES.DISABLED : subscription.renewal_state,
    next_renewal_attempt_at: null,
  });

  return serializeSubscriptionRecord(subscription);
}

async function updateAutoRenew(userId, enabled) {
  const subscription = await Subscription.findOne({
    where: {
      user_id: userId,
      status: 'active',
    },
    include: [{ model: Plan, as: 'plan' }],
    order: [['created_at', 'DESC']],
  });

  if (!subscription) {
    throw AppError.notFound('No active subscription found');
  }

  if (!isAutoRenewEligiblePlan(subscription.plan)) {
    throw AppError.badRequest('Auto-pay is not available for lifetime plans');
  }

  await subscription.update({
    auto_renew: enabled,
    renewal_state: enabled ? RENEWAL_STATES.SCHEDULED : RENEWAL_STATES.DISABLED,
    next_renewal_attempt_at: enabled && subscription.expires_at && new Date(subscription.expires_at) <= new Date()
      ? new Date()
      : (enabled ? subscription.next_renewal_attempt_at : null),
    last_renewal_error: enabled ? null : subscription.last_renewal_error,
  });

  return serializeSubscriptionRecord(subscription);
}

async function getHistory(userId, filtersOrPage, maybeLimit) {
  const filters =
    typeof filtersOrPage === 'object' && filtersOrPage !== null
      ? filtersOrPage
      : { page: filtersOrPage, limit: maybeLimit };
  const { page = 1, limit = 20, search, status, date_from, date_to } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);
  const where = { user_id: userId };
  const include = [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'slug', 'type', 'price', 'currency'] }];

  if (status) {
    where.status = status;
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      const endDate = new Date(date_to);
      endDate.setDate(endDate.getDate() + 1);
      where.created_at[Op.lt] = endDate;
    }
  }

  if (search) {
    include[0].where = {
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ],
    };
    include[0].required = true;
  }

  const { count, rows } = await Subscription.findAndCountAll({
    where,
    include,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  return {
    subscriptions: rows.map(serializeSubscriptionRecord),
    meta: getPaginationMeta(count, page, limit),
  };
}

async function validateCoupon(code, planId, userId) {
  return validateCouponInternal(code, planId, userId);
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

  if (coupon.applicable_plan_ids && Array.isArray(coupon.applicable_plan_ids) && !coupon.applicable_plan_ids.includes(planId)) {
    throw AppError.badRequest('Coupon is not applicable to this plan');
  }

  if (coupon.applicable_user_ids && Array.isArray(coupon.applicable_user_ids) && !coupon.applicable_user_ids.includes(userId)) {
    throw AppError.badRequest('Coupon is not applicable to your account');
  }

  const plan = await Plan.findByPk(planId);
  if (!plan) throw AppError.notFound('Plan not found');

  if (coupon.min_plan_price && Number(plan.price) < Number(coupon.min_plan_price)) {
    throw AppError.badRequest('Plan price does not meet the minimum requirement for this coupon');
  }

  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = Math.round(Number(plan.price) * Number(coupon.discount_value) / 100);
  } else {
    discountAmount = Number(coupon.discount_value);
  }
  discountAmount = Math.min(discountAmount, Number(plan.price));

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

async function markSubscriptionExpired(subscriptionId, reason, options = {}) {
  const { keepGrace = false, renewalState = RENEWAL_STATES.FAILED } = options;
  await Subscription.update(
    {
      status: 'expired',
      auto_renew: false,
      renewal_state: renewalState,
      last_renewal_error: reason || null,
      next_renewal_attempt_at: null,
      ...(keepGrace ? {} : { grace_expires_at: null }),
    },
    {
      where: { id: subscriptionId },
    }
  );
}

async function ensureRenewalAttempt(subscription, amount) {
  return sequelize.transaction(async (transaction) => {
    const lockedSubscription = await loadSubscriptionWithPlanById(subscription.id, transaction, true);
    if (!lockedSubscription || lockedSubscription.status !== 'active') {
      return null;
    }

    const cycleAnchorAt = lockedSubscription.expires_at;
    const attemptNumber = Math.max(1, Number(lockedSubscription.renewal_attempt_count || 0) + 1);
    const idempotencyKey = buildRenewalWalletKey(lockedSubscription.id, cycleAnchorAt, attemptNumber);

    let attempt = await SubscriptionRenewalAttempt.findOne({
      where: { idempotency_key: idempotencyKey },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!attempt) {
      attempt = await SubscriptionRenewalAttempt.create({
        id: generateUUID(),
        subscription_id: lockedSubscription.id,
        cycle_anchor_at: cycleAnchorAt,
        attempt_number: attemptNumber,
        idempotency_key: idempotencyKey,
        amount,
        payment_method: PAYMENT_METHODS.WALLET,
        status: 'pending',
      }, { transaction });

      await lockedSubscription.update({
        renewal_attempt_count: attemptNumber,
      }, { transaction });
    }

    return attempt;
  });
}

async function finalizeRenewalSuccess(subscriptionId, attemptId, amount, taxAmount, paymentMethod, paymentReferenceId) {
  return sequelize.transaction(async (transaction) => {
    const currentSubscription = await loadSubscriptionWithPlanById(subscriptionId, transaction, true);
    const attempt = await SubscriptionRenewalAttempt.findByPk(attemptId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const existingRenewedSubscription = await Subscription.findOne({
      where: {
        replaces_subscription_id: subscriptionId,
        starts_at: currentSubscription?.expires_at || null,
        status: 'active',
      },
      include: [{ model: Plan, as: 'plan' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingRenewedSubscription) {
      if (attempt && attempt.status !== 'succeeded') {
        await attempt.update({
          status: 'succeeded',
          payment_method: paymentMethod,
          transaction_reference_id: paymentReferenceId || null,
          error_message: null,
        }, { transaction });
      }

      return existingRenewedSubscription;
    }

    if (!currentSubscription || currentSubscription.status !== 'active') {
      return null;
    }

    const cycleStart = new Date(currentSubscription.expires_at);
    const { startsAt, expiresAt } = calculateDates(currentSubscription.plan.type, cycleStart);
    const nextAutoRenew = isAutoRenewEligiblePlan(currentSubscription.plan);

    const renewedSubscription = await Subscription.create({
      id: generateUUID(),
      user_id: currentSubscription.user_id,
      plan_id: currentSubscription.plan_id,
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
      amount_paid: amount,
      discount_amount: 0,
      tax_amount: taxAmount,
      coupon_id: null,
      auto_renew: nextAutoRenew,
      payment_method: paymentMethod,
      payment_id: paymentReferenceId || null,
      renewal_state: nextAutoRenew ? RENEWAL_STATES.SCHEDULED : RENEWAL_STATES.INELIGIBLE,
      replaces_subscription_id: currentSubscription.id,
      usage: DEFAULT_USAGE,
    }, { transaction });

    await currentSubscription.update({
      status: 'expired',
      auto_renew: false,
      renewal_state: RENEWAL_STATES.RENEWED,
      grace_expires_at: null,
      next_renewal_attempt_at: null,
      last_renewal_error: null,
    }, { transaction });

    if (attempt) {
      await attempt.update({
        status: 'succeeded',
        payment_method: paymentMethod,
        transaction_reference_id: paymentReferenceId || null,
        error_message: null,
      }, { transaction });
    }

    return loadSubscriptionWithPlanById(renewedSubscription.id, transaction, false);
  });
}

async function handleRenewalFailure(subscription, attempt, message) {
  const now = new Date();
  const graceExpiresAt = getGraceExpiryDate(subscription);
  const graceEnded = !graceExpiresAt || graceExpiresAt <= now;

  await sequelize.transaction(async (transaction) => {
    const lockedSubscription = await loadSubscriptionWithPlanById(subscription.id, transaction, true);
    const lockedAttempt = attempt
      ? await SubscriptionRenewalAttempt.findByPk(attempt.id, { transaction, lock: transaction.LOCK.UPDATE })
      : null;

    if (!lockedSubscription || lockedSubscription.status !== 'active') {
      return;
    }

    if (lockedAttempt) {
      await lockedAttempt.update({
        status: 'failed',
        error_message: message,
      }, { transaction });
    }

    if (graceEnded) {
      await lockedSubscription.update({
        status: 'expired',
        auto_renew: false,
        renewal_state: RENEWAL_STATES.FAILED,
        grace_expires_at: null,
        next_renewal_attempt_at: null,
        last_renewal_error: message,
      }, { transaction });
      return;
    }

    await lockedSubscription.update({
      renewal_state: RENEWAL_STATES.GRACE_PERIOD,
      grace_expires_at: graceExpiresAt,
      next_renewal_attempt_at: new Date(now.getTime() + config.renewal.retryIntervalMs),
      last_renewal_error: message,
    }, { transaction });
  });
}

async function processRenewalCandidate(subscription) {
  const now = new Date();

  if (!subscription.expires_at || new Date(subscription.expires_at) > now) {
    return { renewed: 0, expired: 0, grace: 0 };
  }

  if (!isAutoRenewEligiblePlan(subscription.plan)) {
    await markSubscriptionExpired(subscription.id, 'Auto-pay is not available for this plan.', {
      renewalState: RENEWAL_STATES.INELIGIBLE,
    });
    return { renewed: 0, expired: 1, grace: 0 };
  }

  if (!subscription.auto_renew) {
    if (subscription.grace_expires_at && new Date(subscription.grace_expires_at) > now) {
      return { renewed: 0, expired: 0, grace: 1 };
    }

    await markSubscriptionExpired(
      subscription.id,
      subscription.last_renewal_error || 'Subscription expired without auto-pay.',
      { renewalState: RENEWAL_STATES.DISABLED }
    );
    return { renewed: 0, expired: 1, grace: 0 };
  }

  if (subscription.next_renewal_attempt_at && new Date(subscription.next_renewal_attempt_at) > now) {
    return { renewed: 0, expired: 0, grace: 1 };
  }

  if (!subscription.plan?.is_active) {
    await handleRenewalFailure(subscription, null, 'The plan is no longer available for renewal.');
    return { renewed: 0, expired: 0, grace: 1 };
  }

  const { taxAmount, totalAmount } = calculateTotals(subscription.plan, 0);
  const attempt = await ensureRenewalAttempt(subscription, totalAmount);

  if (totalAmount === 0) {
    const renewedSubscription = await finalizeRenewalSuccess(
      subscription.id,
      attempt?.id || null,
      totalAmount,
      taxAmount,
      PAYMENT_METHODS.FREE,
      'free'
    );

    return { renewed: renewedSubscription ? 1 : 0, expired: 0, grace: 0 };
  }

  try {
    const walletBalance = await getWalletBalance(subscription.user_id);
    if (Number(walletBalance?.balance || 0) < totalAmount) {
      await handleRenewalFailure(subscription, attempt, 'Insufficient wallet balance for auto-pay renewal.');
      return { renewed: 0, expired: 0, grace: 1 };
    }

    const debitResult = await debitWalletForSubscription(
      subscription.user_id,
      totalAmount,
      subscription,
      CHECKOUT_TYPES.RENEWAL,
      attempt.idempotency_key
    );

    const renewedSubscription = await finalizeRenewalSuccess(
      subscription.id,
      attempt.id,
      totalAmount,
      taxAmount,
      PAYMENT_METHODS.WALLET,
      debitResult.transaction_id
    );

    return { renewed: renewedSubscription ? 1 : 0, expired: 0, grace: 0 };
  } catch (err) {
    await handleRenewalFailure(subscription, attempt, err.message || 'Auto-pay renewal failed.');
    return { renewed: 0, expired: 0, grace: 1 };
  }
}

async function checkAndExpireSubscriptions() {
  const dueSubscriptions = await Subscription.findAll({
    where: {
      status: 'active',
      expires_at: { [Op.lte]: new Date(), [Op.ne]: null },
    },
    include: [{ model: Plan, as: 'plan' }],
    order: [['expires_at', 'ASC']],
    limit: config.renewal.batchSize,
  });

  let renewedCount = 0;
  let expiredCount = 0;
  let graceCount = 0;

  for (const subscription of dueSubscriptions) {
    const result = await processRenewalCandidate(subscription);
    renewedCount += result.renewed;
    expiredCount += result.expired;
    graceCount += result.grace;
  }

  return {
    processed_count: dueSubscriptions.length,
    renewed_count: renewedCount,
    expired_count: expiredCount,
    grace_count: graceCount,
  };
}

module.exports = {
  listPlans,
  getPlanBySlug,
  subscribe,
  changePlan,
  verifyPayment,
  getCurrentSubscription,
  cancelSubscription,
  updateAutoRenew,
  getHistory,
  validateCoupon,
  checkLimit,
  incrementUsage,
  resetMonthlyUsage,
  checkAndExpireSubscriptions,
};
