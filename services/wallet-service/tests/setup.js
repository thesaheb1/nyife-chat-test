'use strict';

// jest.mock factories must be self-contained (Babel hoists them).
// Use require() inside test files to access the mocked modules.

jest.mock('../src/models', () => ({
  Wallet: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Transaction: {
    findAndCountAll: jest.fn(),
    create: jest.fn(),
  },
  Invoice: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
  },
}));

jest.mock('razorpay', () => {
  const mockOrders = {
    create: jest.fn(),
    fetch: jest.fn(),
  };
  return jest.fn().mockImplementation(() => ({ orders: mockOrders }));
});

jest.mock('@nyife/shared-utils', () => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
    }
    static badRequest(msg) { return new AppError(msg, 400); }
    static notFound(msg) { return new AppError(msg, 404); }
    static internal(msg) { return new AppError(msg, 500); }
    static conflict(msg) { return new AppError(msg, 409); }
    static forbidden(msg) { return new AppError(msg, 403); }
    static unauthorized(msg) { return new AppError(msg, 401); }
  }
  return {
    AppError,
    generateUUID: jest.fn(() => 'test-uuid-1234'),
    getPagination: jest.fn((page, limit) => ({
      offset: ((page || 1) - 1) * (limit || 20),
      limit: limit || 20,
    })),
    getPaginationMeta: jest.fn((total, page, limit) => ({
      page: page || 1,
      limit: limit || 20,
      total,
      totalPages: Math.ceil(total / (limit || 20)),
    })),
    formatCurrency: jest.fn((amount) => `₹${(amount / 100).toFixed(2)}`),
  };
});

jest.mock('@nyife/shared-events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
  TOPICS: { WALLET_TRANSACTION: 'wallet.transaction' },
}));

jest.mock('../src/config', () => ({
  razorpay: { keyId: 'rzp_test_key', keySecret: 'rzp_test_secret' },
  tax: { rate: 18, inclusive: false, type: 'GST' },
  minRechargeAmount: 10000,
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Re-set default transaction mock
  const { sequelize } = require('../src/models');
  sequelize.transaction.mockImplementation((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
});
