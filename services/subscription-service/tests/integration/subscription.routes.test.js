'use strict';

jest.mock('@nyife/shared-middleware', () => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
    }
    static badRequest(msg) { return new AppError(msg, 400); }
    static unauthorized(msg) { return new AppError(msg, 401); }
    static notFound(msg) { return new AppError(msg, 404); }
    static conflict(msg) { return new AppError(msg, 409); }
    static forbidden(msg) { return new AppError(msg, 403); }
  }

  return {
    authenticate: (req, res, next) => {
      req.user = { id: 'test-user-uuid', email: 'user@example.com', role: 'user' };
      next();
    },
    organizationResolver: (req, _res, next) => next(),
    rbac: () => (_req, _res, next) => next(),
    asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
    errorHandler: (err, req, res, _next) => {
      if (err.name === 'ZodError') {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
      }
      if (err.isOperational) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Internal server error' });
    },
    AppError,
  };
});

jest.mock('../../src/services/subscription.service');
jest.mock('../../src/config', () => ({
  nodeEnv: 'test',
  port: 3003,
  razorpayKeyId: 'rzp_test',
  razorpayKeySecret: 'test_secret',
}));
jest.mock('@nyife/shared-utils', () => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
    }
    static badRequest(msg) { return new AppError(msg, 400); }
    static notFound(msg) { return new AppError(msg, 404); }
    static conflict(msg) { return new AppError(msg, 409); }
  }
  return {
    AppError,
    successResponse: (res, data, message = 'Success', statusCode = 200, meta = null) => {
      const response = { success: true, message, data };
      if (meta) response.meta = meta;
      return res.status(statusCode).json(response);
    },
    errorResponse: (res, message, errors = [], statusCode = 500) => {
      return res.status(statusCode).json({ success: false, message, errors });
    },
  };
});

const request = require('supertest');
const app = require('../../src/app');
const subscriptionService = require('../../src/services/subscription.service');

beforeEach(() => { jest.clearAllMocks(); });

// ─── GET /api/v1/subscriptions/plans (public) ────────────────────────────────

describe('GET /api/v1/subscriptions/plans', () => {
  it('should return 200 with plans', async () => {
    subscriptionService.listPlans.mockResolvedValue([{ id: 'plan-1', name: 'Pro' }]);

    const res = await request(app).get('/api/v1/subscriptions/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plans).toHaveLength(1);
  });
});

// ─── GET /api/v1/subscriptions/plans/:slug (public) ─────────────────────────

describe('GET /api/v1/subscriptions/plans/:slug', () => {
  it('should return 200 with plan', async () => {
    subscriptionService.getPlanBySlug.mockResolvedValue({ id: 'plan-1', slug: 'pro-monthly' });

    const res = await request(app).get('/api/v1/subscriptions/plans/pro-monthly');

    expect(res.status).toBe(200);
    expect(res.body.data.plan.slug).toBe('pro-monthly');
  });

  it('should return 404 when not found', async () => {
    const err = new Error('Plan not found');
    err.statusCode = 404;
    err.isOperational = true;
    subscriptionService.getPlanBySlug.mockRejectedValue(err);

    const res = await request(app).get('/api/v1/subscriptions/plans/nonexistent');

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/subscriptions/subscribe ────────────────────────────────────

describe('POST /api/v1/subscriptions/subscribe', () => {
  it('should return 201 on success', async () => {
    subscriptionService.subscribe.mockResolvedValue({ payment_required: true, razorpay_order: { id: 'order_1' } });

    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('Authorization', 'Bearer mock')
      .send({ plan_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

    expect(res.status).toBe(201);
    expect(res.body.data.payment_required).toBe(true);
  });

  it('should return 400 on invalid plan_id', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/subscribe')
      .set('Authorization', 'Bearer mock')
      .send({ plan_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/subscriptions/change-plan', () => {
  it('should return 201 on success', async () => {
    subscriptionService.changePlan.mockResolvedValue({
      payment_required: true,
      previous_subscription_id: 'sub-old',
      razorpay_order: { id: 'order_change' },
    });

    const res = await request(app)
      .post('/api/v1/subscriptions/change-plan')
      .set('Authorization', 'Bearer mock')
      .send({ plan_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

    expect(res.status).toBe(201);
    expect(res.body.data.previous_subscription_id).toBe('sub-old');
  });

  it('should return 400 on invalid plan_id', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/change-plan')
      .set('Authorization', 'Bearer mock')
      .send({ plan_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/subscriptions/verify-payment ──────────────────────────────

describe('POST /api/v1/subscriptions/verify-payment', () => {
  it('should return 200 on valid payment', async () => {
    subscriptionService.verifyPayment.mockResolvedValue({ id: 'sub-1', status: 'active' });

    const res = await request(app)
      .post('/api/v1/subscriptions/verify-payment')
      .set('Authorization', 'Bearer mock')
      .send({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_valid',
        subscription_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/verify-payment')
      .set('Authorization', 'Bearer mock')
      .send({ razorpay_order_id: 'order_1' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/subscriptions/current ───────────────────────────────────────

describe('GET /api/v1/subscriptions/current', () => {
  it('should return 200 with current subscription', async () => {
    subscriptionService.getCurrentSubscription.mockResolvedValue({ id: 'sub-1', status: 'active' });

    const res = await request(app).get('/api/v1/subscriptions/current').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.data.subscription.status).toBe('active');
  });

  it('should return 200 with null when no subscription', async () => {
    subscriptionService.getCurrentSubscription.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/subscriptions/current').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.data.subscription).toBeNull();
  });
});

describe('PATCH /api/v1/subscriptions/current/auto-renew', () => {
  it('should return 200 when toggling auto-renew', async () => {
    subscriptionService.updateAutoRenew.mockResolvedValue({ id: 'sub-1', auto_renew: true });

    const res = await request(app)
      .patch('/api/v1/subscriptions/current/auto-renew')
      .set('Authorization', 'Bearer mock')
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscription.auto_renew).toBe(true);
  });

  it('should return 400 on invalid payload', async () => {
    const res = await request(app)
      .patch('/api/v1/subscriptions/current/auto-renew')
      .set('Authorization', 'Bearer mock')
      .send({ enabled: 'yes' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/subscriptions/cancel ───────────────────────────────────────

describe('POST /api/v1/subscriptions/cancel', () => {
  it('should return 200 on successful cancel', async () => {
    subscriptionService.cancelSubscription.mockResolvedValue({ id: 'sub-1', status: 'cancelled' });

    const res = await request(app)
      .post('/api/v1/subscriptions/cancel')
      .set('Authorization', 'Bearer mock')
      .send({ reason: 'Too expensive' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/v1/subscriptions/history ───────────────────────────────────────

describe('GET /api/v1/subscriptions/history', () => {
  it('should return 200 with paginated history', async () => {
    subscriptionService.getHistory.mockResolvedValue({
      subscriptions: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app).get('/api/v1/subscriptions/history').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/v1/subscriptions/check-limit/:userId/:resource (internal) ─────

describe('GET /api/v1/subscriptions/check-limit/:userId/:resource', () => {
  it('should return 200 with limit check result', async () => {
    subscriptionService.checkLimit.mockResolvedValue({ allowed: true, remaining: 4900 });

    const res = await request(app).get('/api/v1/subscriptions/check-limit/a1b2c3d4-e5f6-7890-abcd-ef1234567890/contacts');

    expect(res.status).toBe(200);
    expect(res.body.data.allowed).toBe(true);
  });

  it('should return 400 on invalid resource', async () => {
    const res = await request(app).get('/api/v1/subscriptions/check-limit/a1b2c3d4-e5f6-7890-abcd-ef1234567890/invalid_resource');

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/subscriptions/increment-usage/:userId (internal) ──────────

describe('POST /api/v1/subscriptions/increment-usage/:userId', () => {
  it('should return 200 on success', async () => {
    subscriptionService.incrementUsage.mockResolvedValue({ resource: 'contacts', new_count: 15 });

    const res = await request(app)
      .post('/api/v1/subscriptions/increment-usage/user-uuid-1')
      .send({ resource: 'contacts', count: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.new_count).toBe(15);
  });
});

// ─── Health & 404 ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Unknown route', () => {
  it('should return 404', async () => {
    const res = await request(app).get('/api/v1/subscriptions/nonexistent');
    expect(res.status).toBe(404);
  });
});
