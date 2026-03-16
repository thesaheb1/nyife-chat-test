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
    static internal(msg) { return new AppError(msg, 500); }
  }

  return {
    authenticate: (req, res, next) => {
      req.user = { id: 'test-user-uuid', email: 'user@example.com', role: 'user' };
      next();
    },
    organizationResolver: (req, res, next) => next(),
    rbac: () => (req, res, next) => next(),
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

jest.mock('../../src/services/wallet.service');
jest.mock('../../src/config', () => ({
  nodeEnv: 'test',
  port: 3004,
  razorpayKeyId: 'rzp_test_key',
  razorpayKeySecret: 'test_secret',
}));
jest.mock('razorpay', () => {
  const mockOrders = {
    create: jest.fn(),
    fetch: jest.fn(),
  };
  return jest.fn().mockImplementation(() => ({ orders: mockOrders }));
}, { virtual: true });
jest.mock('@nyife/shared-utils', () => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
    }
    static badRequest(msg) { return new AppError(msg, 400); }
    static notFound(msg) { return new AppError(msg, 404); }
    static forbidden(msg) { return new AppError(msg, 403); }
  }
  return {
    AppError,
    isValidRupeeAmount: jest.fn((amount, options = {}) => {
      const allowZero = options.allowZero !== false;
      if (!Number.isFinite(amount)) return false;
      if (allowZero ? amount < 0 : amount <= 0) return false;
      return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8;
    }),
    rupeesToPaise: jest.fn((amount) => Math.round(amount * 100)),
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
const walletService = require('../../src/services/wallet.service');

beforeEach(() => { jest.clearAllMocks(); });

// ─── GET /api/v1/wallet ──────────────────────────────────────────────────────

describe('GET /api/v1/wallet', () => {
  it('should return 200 with balance', async () => {
    walletService.getBalance.mockResolvedValue({ balance: 50000, currency: 'INR' });

    const res = await request(app).get('/api/v1/wallet').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.balance).toBe(50000);
  });
});

// ─── POST /api/v1/wallet/recharge ────────────────────────────────────────────

describe('POST /api/v1/wallet/recharge', () => {
  it('should return 201 on valid recharge', async () => {
    walletService.initiateRecharge.mockResolvedValue({
      order_id: 'order_test',
      amount: 100000,
      currency: 'INR',
    });

    const res = await request(app)
      .post('/api/v1/wallet/recharge')
      .set('Authorization', 'Bearer mock')
      .send({ amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body.data.order_id).toBe('order_test');
    expect(walletService.initiateRecharge).toHaveBeenCalledWith('test-user-uuid', 10000);
  });

  it('should return 400 on invalid amount', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/recharge')
      .set('Authorization', 'Bearer mock')
      .send({ amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/v1/wallet/recharge/verify ─────────────────────────────────────

describe('POST /api/v1/wallet/recharge/verify', () => {
  it('should return 200 on valid payment verification', async () => {
    walletService.verifyRechargePayment.mockResolvedValue({ wallet: { balance: 150000 }, transaction: { id: 'txn-1' } });

    const res = await request(app)
      .post('/api/v1/wallet/recharge/verify')
      .set('Authorization', 'Bearer mock')
      .send({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_valid',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/recharge/verify')
      .set('Authorization', 'Bearer mock')
      .send({ razorpay_order_id: 'order_1' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/wallet/transactions ─────────────────────────────────────────

describe('GET /api/v1/wallet/transactions', () => {
  it('should return 200 with paginated transactions', async () => {
    walletService.listTransactions.mockResolvedValue({
      transactions: [{ id: 'txn-1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get('/api/v1/wallet/transactions').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/v1/wallet/invoices ─────────────────────────────────────────────

describe('GET /api/v1/wallet/invoices', () => {
  it('should return 200 with invoices', async () => {
    walletService.listInvoices.mockResolvedValue({
      invoices: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app).get('/api/v1/wallet/invoices').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/v1/wallet/invoices/:id ─────────────────────────────────────────

describe('GET /api/v1/wallet/invoices/:id', () => {
  it('should return 200 on valid invoice', async () => {
    walletService.getInvoice.mockResolvedValue({ id: 'inv-1', amount: 50000 });

    const res = await request(app).get('/api/v1/wallet/invoices/inv-1').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('inv-1');
  });

  it('should return 404 when not found', async () => {
    const err = new Error('Invoice not found');
    err.statusCode = 404;
    err.isOperational = true;
    walletService.getInvoice.mockRejectedValue(err);

    const res = await request(app).get('/api/v1/wallet/invoices/bad-id').set('Authorization', 'Bearer mock');

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/v1/wallet/debit (internal) ────────────────────────────────────

describe('POST /api/v1/wallet/debit (internal)', () => {
  it('should return 200 on valid debit', async () => {
    walletService.debitWallet.mockResolvedValue({ balance: 40000, transaction_id: 'txn-2' });

    const res = await request(app).post('/api/v1/wallet/debit').send({
      user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      amount: 10000,
      source: 'message_debit',
      description: 'Campaign cost',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on missing user_id', async () => {
    const res = await request(app).post('/api/v1/wallet/debit').send({ amount: 10000, source: 'campaign' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/wallet/balance/:userId (internal) ──────────────────────────

describe('GET /api/v1/wallet/balance/:userId (internal)', () => {
  it('should return 200 with balance', async () => {
    walletService.getBalance.mockResolvedValue({ balance: 75000, currency: 'INR' });

    const res = await request(app).get('/api/v1/wallet/balance/user-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(75000);
  });
});

// ─── POST /api/v1/wallet/admin/credit ────────────────────────────────────────

describe('POST /api/v1/wallet/admin/credit', () => {
  it('should return 403 for non-admin user', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/admin/credit')
      .set('Authorization', 'Bearer mock')
      .send({ user_id: 'user-1', amount: 5000, remarks: 'Bonus' });

    expect(res.status).toBe(403);
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
    const res = await request(app).get('/api/v1/wallet/nonexistent-route');
    expect(res.status).toBe(404);
  });
});
