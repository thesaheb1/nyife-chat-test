'use strict';

jest.mock('../src/models', () => ({
  Plan: { findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() },
  Coupon: { findOne: jest.fn(), increment: jest.fn() },
  Subscription: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
  },
  SubscriptionRenewalAttempt: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
    QueryTypes: { UPDATE: 'UPDATE', SELECT: 'SELECT' },
  },
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
    static forbidden(msg) { return new AppError(msg, 403); }
    static internal(msg) { return new AppError(msg, 500); }
  }
  return {
    AppError,
    generateUUID: jest.fn(() => 'test-uuid-1234'),
    getPagination: jest.fn((page, limit) => ({ offset: ((page || 1) - 1) * (limit || 20), limit: limit || 20 })),
    getPaginationMeta: jest.fn((total, page, limit) => ({ page: page || 1, limit: limit || 20, total, totalPages: Math.ceil(total / (limit || 20)) })),
  };
});

jest.mock('../src/config', () => ({
  tax: { rate: 18, inclusive: false },
  razorpay: { keyId: 'test_key', keySecret: 'test_secret' },
  walletServiceUrl: 'http://wallet:3004',
  renewal: {
    gracePeriodMs: 3 * 24 * 60 * 60 * 1000,
    retryIntervalMs: 24 * 60 * 60 * 1000,
    batchSize: 100,
  },
}));

jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({ orders: { create: jest.fn() } })), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});
