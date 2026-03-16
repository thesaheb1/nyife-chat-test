'use strict';

require('../setup');

const subscriptionService = require('../../src/services/subscription.service');
const { Plan, Coupon, Subscription, sequelize } = require('../../src/models');

const USER_ID = 'user-uuid-1';

function makePlan(overrides = {}) {
  return {
    id: 'plan-uuid-1',
    name: 'Pro Monthly',
    slug: 'pro-monthly',
    type: 'monthly',
    price: 100000,
    currency: 'INR',
    is_active: true,
    sort_order: 1,
    max_contacts: 5000,
    max_templates: 50,
    max_campaigns_per_month: 20,
    max_messages_per_month: 10000,
    max_team_members: 5,
    max_organizations: 1,
    max_whatsapp_numbers: 2,
    ...overrides,
  };
}

function makeSubscription(overrides = {}) {
  return {
    id: 'sub-uuid-1',
    user_id: USER_ID,
    plan_id: 'plan-uuid-1',
    status: 'active',
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    usage: {},
    plan: makePlan(),
    coupon_id: null,
    update: jest.fn(function (data) { Object.assign(this, data); return this; }),
    reload: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  };
}

function makeCoupon(overrides = {}) {
  return {
    id: 'coupon-uuid-1',
    code: 'SAVE20',
    discount_type: 'percentage',
    discount_value: 20,
    is_active: true,
    max_uses: 100,
    used_count: 5,
    valid_from: new Date(Date.now() - 86400000),
    valid_until: new Date(Date.now() + 86400000),
    applicable_plan_ids: null,
    applicable_user_ids: null,
    min_plan_price: null,
    ...overrides,
  };
}

function mockFetchResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  };
}

// ─── listPlans ────────────────────────────────────────────────────────────────

describe('listPlans', () => {
  it('should return all active plans sorted', async () => {
    const plans = [makePlan()];
    Plan.findAll.mockResolvedValue(plans);

    const result = await subscriptionService.listPlans();

    expect(Plan.findAll).toHaveBeenCalledWith({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['price', 'ASC']],
    });
    expect(result).toEqual(plans);
  });
});

// ─── getPlanBySlug ────────────────────────────────────────────────────────────

describe('getPlanBySlug', () => {
  it('should return plan when found', async () => {
    const plan = makePlan();
    Plan.findOne.mockResolvedValue(plan);

    const result = await subscriptionService.getPlanBySlug('pro-monthly');
    expect(result).toEqual(plan);
  });

  it('should throw notFound when plan not found', async () => {
    Plan.findOne.mockResolvedValue(null);

    await expect(subscriptionService.getPlanBySlug('nonexistent'))
      .rejects.toThrow('Plan not found');
  });
});

// ─── subscribe ────────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('should create pending subscription for paid plan', async () => {
    const plan = makePlan();
    Plan.findByPk.mockResolvedValue(plan);
    const createdSub = makeSubscription({ status: 'pending', plan });
    createdSub.destroy = jest.fn();
    Subscription.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdSub);
    Subscription.create.mockResolvedValue(createdSub);
    global.fetch.mockResolvedValueOnce(mockFetchResponse({
      success: true,
      data: { balance: 0 },
    }));

    // Mock Razorpay — service creates a new instance inside subscribe()
    const Razorpay = require('razorpay');
    Razorpay.mockImplementation(() => ({
      orders: {
        create: jest.fn().mockResolvedValue({
          id: 'order_test', amount: 118000, currency: 'INR',
        }),
      },
    }));

    const result = await subscriptionService.subscribe(USER_ID, { plan_id: 'plan-uuid-1' });

    expect(Subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      user_id: USER_ID,
    }));
    expect(Subscription.destroy).toHaveBeenCalledWith({
      where: { user_id: USER_ID, status: 'pending' },
      force: true,
    });
    expect(result.payment_required).toBe(true);
    expect(result.razorpay_order.id).toBe('order_test');
  });

  it('should activate immediately for free plan', async () => {
    const freePlan = makePlan({ price: 0 });
    Plan.findByPk.mockResolvedValue(freePlan);
    const createdSub = makeSubscription({ status: 'pending', plan: freePlan, expires_at: null });
    Subscription.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdSub);
    Subscription.create.mockResolvedValue(createdSub);

    const result = await subscriptionService.subscribe(USER_ID, { plan_id: 'plan-uuid-1' });

    expect(Subscription.destroy).toHaveBeenCalledWith({
      where: { user_id: USER_ID, status: 'pending' },
      force: true,
    });
    expect(createdSub.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      payment_id: 'free',
      payment_method: 'free',
    }), expect.any(Object));
    expect(result.payment_required).toBe(false);
  });

  it('should throw conflict if user already has active subscription', async () => {
    Plan.findByPk.mockResolvedValue(makePlan());
    Subscription.findOne.mockResolvedValue(makeSubscription());

    await expect(subscriptionService.subscribe(USER_ID, { plan_id: 'plan-uuid-1' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('should throw notFound if plan not found', async () => {
    Plan.findByPk.mockResolvedValue(null);

    await expect(subscriptionService.subscribe(USER_ID, { plan_id: 'bad' }))
      .rejects.toThrow('Plan not found or inactive');
  });
});

describe('changePlan', () => {
  it('should keep the old subscription active until the paid replacement is completed', async () => {
    const currentSubscription = makeSubscription({
      id: 'sub-current',
      plan_id: 'plan-old',
      plan: makePlan({ id: 'plan-old' }),
    });
    const newPlan = makePlan({ id: 'plan-new' });
    const pendingReplacement = makeSubscription({
      id: 'sub-new',
      status: 'pending',
      plan_id: 'plan-new',
      plan: newPlan,
      replaces_subscription_id: 'sub-current',
    });
    pendingReplacement.destroy = jest.fn();

    Plan.findByPk.mockResolvedValue(newPlan);
    Subscription.findOne
      .mockResolvedValueOnce(currentSubscription)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingReplacement);
    Subscription.create.mockResolvedValue(pendingReplacement);
    global.fetch.mockResolvedValueOnce(mockFetchResponse({
      success: true,
      data: { balance: 0 },
    }));

    const Razorpay = require('razorpay');
    Razorpay.mockImplementation(() => ({
      orders: {
        create: jest.fn().mockResolvedValue({
          id: 'order_change', amount: 118000, currency: 'INR',
        }),
      },
    }));

    const result = await subscriptionService.changePlan(USER_ID, { plan_id: 'plan-new' });

    expect(Subscription.destroy).toHaveBeenCalledWith({
      where: { user_id: USER_ID, status: 'pending' },
      force: true,
    });
    expect(currentSubscription.update).not.toHaveBeenCalled();
    expect(result.previous_subscription_id).toBe('sub-current');
    expect(result.payment_required).toBe(true);
    expect(result.razorpay_order.id).toBe('order_change');
  });

  it('should activate immediately for a free replacement plan', async () => {
    const currentSubscription = makeSubscription({
      id: 'sub-current',
      plan_id: 'plan-old',
      plan: makePlan({ id: 'plan-old' }),
    });
    const freePlan = makePlan({ id: 'plan-free', price: 0 });
    const pendingReplacement = makeSubscription({
      id: 'sub-free',
      status: 'pending',
      plan_id: 'plan-free',
      plan: freePlan,
      expires_at: null,
      replaces_subscription_id: 'sub-current',
    });

    Plan.findByPk.mockResolvedValue(freePlan);
    Subscription.findByPk.mockResolvedValue(currentSubscription);
    Subscription.findOne
      .mockResolvedValueOnce(currentSubscription)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingReplacement);
    Subscription.create.mockResolvedValue(pendingReplacement);

    const result = await subscriptionService.changePlan(USER_ID, { plan_id: 'plan-free' });

    expect(currentSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'cancelled',
      cancellation_reason: 'plan_changed',
    }), expect.any(Object));
    expect(pendingReplacement.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      payment_id: 'free',
      payment_method: 'free',
    }), expect.any(Object));
    expect(result.payment_required).toBe(false);
    expect(result.previous_subscription_id).toBe('sub-current');
  });

  it('should reject changing to the same plan', async () => {
    const samePlan = makePlan({ id: 'plan-same' });
    const currentSubscription = makeSubscription({
      plan_id: 'plan-same',
      plan: samePlan,
    });

    Plan.findByPk.mockResolvedValue(samePlan);
    Subscription.findOne.mockResolvedValue(currentSubscription);

    await expect(subscriptionService.changePlan(USER_ID, { plan_id: 'plan-same' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('should reject when there is no active subscription', async () => {
    Plan.findByPk.mockResolvedValue(makePlan({ id: 'plan-new' }));
    Subscription.findOne.mockResolvedValue(null);

    await expect(subscriptionService.changePlan(USER_ID, { plan_id: 'plan-new' }))
      .rejects.toThrow('No active subscription found');
  });
});

// ─── verifyPayment ────────────────────────────────────────────────────────────

describe('verifyPayment', () => {
  const crypto = require('crypto');

  function validSig(orderId, paymentId) {
    return crypto.createHmac('sha256', 'test_secret')
      .update(`${orderId}|${paymentId}`).digest('hex');
  }

  it('should activate subscription on valid signature', async () => {
    const sig = validSig('order_1', 'pay_1');
    const sub = makeSubscription({ status: 'pending' });
    Subscription.findOne.mockResolvedValue(sub);

    await subscriptionService.verifyPayment(USER_ID, {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: sig,
      subscription_id: 'sub-uuid-1',
    });

    expect(sub.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      payment_id: 'pay_1',
      payment_method: 'razorpay',
    }), expect.any(Object));
  });

  it('should throw on invalid signature', async () => {
    await expect(subscriptionService.verifyPayment(USER_ID, {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'bad',
      subscription_id: 'sub-1',
    })).rejects.toThrow('Invalid payment signature');
  });

  it('should throw if pending subscription not found', async () => {
    const sig = validSig('order_1', 'pay_1');
    Subscription.findOne.mockResolvedValue(null);

    await expect(subscriptionService.verifyPayment(USER_ID, {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: sig,
      subscription_id: 'sub-1',
    })).rejects.toThrow('Pending subscription not found');
  });

  it('should increment coupon usage if coupon_id present', async () => {
    const sig = validSig('order_1', 'pay_1');
    const sub = makeSubscription({ status: 'pending', coupon_id: 'coupon-1' });
    Subscription.findOne.mockResolvedValue(sub);

    await subscriptionService.verifyPayment(USER_ID, {
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: sig,
      subscription_id: 'sub-1',
    });

    expect(Coupon.increment).toHaveBeenCalledWith('used_count', expect.objectContaining({
      where: { id: 'coupon-1' },
    }));
  });
});

// ─── getCurrentSubscription ───────────────────────────────────────────────────

describe('getCurrentSubscription', () => {
  it('should return active subscription', async () => {
    const sub = makeSubscription();
    Subscription.findOne.mockResolvedValue(sub);

    const result = await subscriptionService.getCurrentSubscription(USER_ID);
    expect(result).toEqual(expect.objectContaining({
      id: sub.id,
      auto_renew_eligible: true,
    }));
  });

  it('should return null if no active subscription', async () => {
    Subscription.findOne.mockResolvedValue(null);

    const result = await subscriptionService.getCurrentSubscription(USER_ID);
    expect(result).toBeNull();
  });
});

// ─── cancelSubscription ───────────────────────────────────────────────────────

describe('cancelSubscription', () => {
  it('should cancel active subscription', async () => {
    const sub = makeSubscription();
    Subscription.findOne.mockResolvedValue(sub);

    await subscriptionService.cancelSubscription(USER_ID, 'Too expensive');

    expect(sub.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'cancelled',
      cancellation_reason: 'Too expensive',
      auto_renew: false,
    }));
  });

  it('should throw if no active subscription', async () => {
    Subscription.findOne.mockResolvedValue(null);

    await expect(subscriptionService.cancelSubscription(USER_ID, 'reason'))
      .rejects.toThrow('No active subscription found');
  });
});

// ─── getHistory ───────────────────────────────────────────────────────────────

describe('getHistory', () => {
  it('should return paginated subscriptions', async () => {
    const subs = [makeSubscription()];
    Subscription.findAndCountAll.mockResolvedValue({ count: 1, rows: subs });

    const result = await subscriptionService.getHistory(USER_ID, 1, 20);

    expect(result.subscriptions[0]).toEqual(expect.objectContaining({
      id: subs[0].id,
      auto_renew_eligible: true,
    }));
    expect(result.meta.total).toBe(1);
  });
});

// ─── checkLimit ───────────────────────────────────────────────────────────────

describe('checkLimit', () => {
  it('should return allowed: true when under limit', async () => {
    const sub = makeSubscription({
      usage: { contacts_used: 100 },
      plan: makePlan({ max_contacts: 5000 }),
    });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await subscriptionService.checkLimit(USER_ID, 'contacts');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4900);
  });

  it('should return allowed: false when at limit', async () => {
    const sub = makeSubscription({
      usage: { contacts_used: 5000 },
      plan: makePlan({ max_contacts: 5000 }),
    });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await subscriptionService.checkLimit(USER_ID, 'contacts');
    expect(result.allowed).toBe(false);
  });

  it('should return unlimited when limit is 0', async () => {
    const sub = makeSubscription({
      usage: { contacts_used: 99999 },
      plan: makePlan({ max_contacts: 0 }),
    });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await subscriptionService.checkLimit(USER_ID, 'contacts');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe('unlimited');
  });

  it('should return allowed: false when no subscription', async () => {
    Subscription.findOne.mockResolvedValue(null);

    const result = await subscriptionService.checkLimit(USER_ID, 'contacts');
    expect(result.allowed).toBe(false);
    expect(result.message).toBe('No active subscription');
  });

  it('should throw for unknown resource', async () => {
    await expect(subscriptionService.checkLimit(USER_ID, 'invalid'))
      .rejects.toThrow('Unknown resource: invalid');
  });
});

// ─── incrementUsage ───────────────────────────────────────────────────────────

describe('incrementUsage', () => {
  it('should increment usage counter', async () => {
    const sub = makeSubscription({ usage: { contacts_used: 10 } });
    Subscription.findOne.mockResolvedValue(sub);

    const result = await subscriptionService.incrementUsage(USER_ID, 'contacts', 5);

    expect(sub.update).toHaveBeenCalled();
    expect(result.resource).toBe('contacts');
    expect(result.new_count).toBe(15);
  });

  it('should throw if no active subscription', async () => {
    Subscription.findOne.mockResolvedValue(null);

    await expect(subscriptionService.incrementUsage(USER_ID, 'contacts'))
      .rejects.toThrow('No active subscription found');
  });

  it('should throw for unknown resource', async () => {
    await expect(subscriptionService.incrementUsage(USER_ID, 'bad'))
      .rejects.toThrow('Unknown resource: bad');
  });
});

// ─── resetMonthlyUsage ────────────────────────────────────────────────────────

describe('resetMonthlyUsage', () => {
  it('should run raw SQL UPDATE', async () => {
    sequelize.query.mockResolvedValue([42]);

    const result = await subscriptionService.resetMonthlyUsage();

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sub_subscriptions'),
      expect.any(Object)
    );
    expect(result.reset_count).toBe(42);
  });
});

// ─── checkAndExpireSubscriptions ──────────────────────────────────────────────

describe('checkAndExpireSubscriptions', () => {
  it('should expire a due subscription when auto-renew is disabled', async () => {
    Subscription.findAll.mockResolvedValue([
      makeSubscription({
        status: 'active',
        auto_renew: false,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    ]);
    Subscription.update.mockResolvedValue([1]);

    const result = await subscriptionService.checkAndExpireSubscriptions();

    expect(Subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
      expect.objectContaining({ where: { id: 'sub-uuid-1' } })
    );
    expect(result.expired_count).toBe(1);
  });
});
