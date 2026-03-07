'use strict';

jest.mock('../src/models', () => ({
  Automation: { findOne: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn(), create: jest.fn(), update: jest.fn() },
  AutomationLog: { findAndCountAll: jest.fn(), create: jest.fn() },
  Webhook: { findOne: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn(), create: jest.fn() },
  sequelize: { query: jest.fn(), QueryTypes: { SELECT: 'SELECT' } },
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

jest.mock('axios');

jest.mock('../src/config', () => ({
  whatsappServiceUrl: 'http://whatsapp:3009',
  contactServiceUrl: 'http://contact:3005',
}));

jest.mock('../src/helpers/matcher', () => ({
  findMatchingAutomation: jest.fn(),
}));

jest.mock('../src/helpers/flowEngine', () => ({
  getFlowState: jest.fn(),
  setFlowState: jest.fn(),
  clearFlowState: jest.fn(),
  findStep: jest.fn(),
  processFlowStep: jest.fn(),
}));

beforeEach(() => { jest.clearAllMocks(); });
