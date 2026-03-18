'use strict';

jest.mock('../src/models', () => {
  const mockUserInstance = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    phone: '+1234567890',
    role: 'user',
    status: 'active',
    login_count: 0,
    email_verified_at: null,
    email_verification_token: null,
    email_verification_expires: null,
    password_reset_token: null,
    password_reset_expires: null,
    last_login_at: null,
    last_login_ip: null,
    google_id: null,
    facebook_id: null,
    avatar_url: null,
    toSafeJSON: jest.fn().mockReturnValue({
      id: 'user-uuid-1', email: 'test@example.com', first_name: 'Test',
      last_name: 'User', role: 'user', status: 'active',
    }),
    comparePassword: jest.fn().mockResolvedValue(true),
    generateAccessToken: jest.fn().mockReturnValue('mock-access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
    update: jest.fn().mockResolvedValue(true),
  };

  return {
    User: {
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn().mockResolvedValue(mockUserInstance),
      unscoped: jest.fn().mockReturnValue({ findOne: jest.fn() }),
      scope: jest.fn().mockReturnValue({ findOne: jest.fn() }),
      __mockInstance: mockUserInstance,
    },
    RefreshToken: {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue([1]),
    },
    sequelize: {
      query: jest.fn().mockResolvedValue([[], null]),
      transaction: jest.fn(async (callback) => callback({})),
    },
  };
});

jest.mock('@nyife/shared-utils', () => {
  class AppError extends Error {
    constructor(message, statusCode, errors = [], isOperational = true) {
      super(message);
      this.name = 'AppError';
      this.statusCode = statusCode;
      this.errors = errors;
      this.isOperational = isOperational;
      this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    }
    static badRequest(msg = 'Bad request', errors = []) { return new AppError(msg, 400, errors); }
    static unauthorized(msg = 'Unauthorized') { return new AppError(msg, 401); }
    static forbidden(msg = 'Forbidden') { return new AppError(msg, 403); }
    static notFound(msg = 'Resource not found') { return new AppError(msg, 404); }
    static conflict(msg = 'Resource already exists') { return new AppError(msg, 409); }
    static internal(msg = 'Internal server error') { return new AppError(msg, 500, [], false); }
  }
  return {
    AppError,
    generateUUID: jest.fn().mockReturnValue('generated-uuid'),
    buildDefaultOrganizationSeed: jest.fn(({ userId, firstName }) => ({
      name: `${firstName || 'User'}'s Org`,
      description: `${firstName || 'User'}'s first organization`,
      slug: `seed-${String(userId).slice(0, 8)}`,
    })),
  };
});

jest.mock('../src/config', () => ({
  jwt: { secret: 'test-secret', accessExpiry: '15m', refreshExpiry: '7d' },
}));

beforeEach(() => { jest.clearAllMocks(); });
