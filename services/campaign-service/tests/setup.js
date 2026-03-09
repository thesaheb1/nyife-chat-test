'use strict';

jest.mock('../src/models', () => ({
  Campaign: { findOne: jest.fn(), findAndCountAll: jest.fn(), create: jest.fn(), update: jest.fn(), findByPk: jest.fn() },
  CampaignMessage: { bulkCreate: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), findAndCountAll: jest.fn(), update: jest.fn(), count: jest.fn() },
  sequelize: { fn: jest.fn((...args) => args), col: jest.fn((c) => c), literal: jest.fn((s) => s), query: jest.fn(), QueryTypes: { SELECT: 'SELECT' }, transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })) },
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

jest.mock('@nyife/shared-events', () => ({
  TOPICS: { CAMPAIGN_EXECUTE: 'campaign.execute' },
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}), { virtual: true });

jest.mock('../src/config', () => ({
  subscriptionServiceUrl: 'http://subscription:3003',
  templateServiceUrl: 'http://template:3006',
  walletServiceUrl: 'http://wallet:3004',
  contactServiceUrl: 'http://contact:3005',
  nodeEnv: 'test',
}));

jest.mock('../src/helpers/variableResolver', () => ({
  resolveVariables: jest.fn(() => ({ '1': 'John' })),
  buildTemplateComponents: jest.fn(() => []),
}));

beforeEach(() => { jest.clearAllMocks(); });
