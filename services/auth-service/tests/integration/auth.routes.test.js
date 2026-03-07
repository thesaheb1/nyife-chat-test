'use strict';

// Mock shared middleware BEFORE requiring app
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
    authenticateOptional: (req, res, next) => { req.user = null; next(); },
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
    rbac: () => (req, res, next) => next(),
    tenantResolver: (req, res, next) => next(),
    createRateLimiter: () => (req, res, next) => next(),
    requestLogger: (req, res, next) => next(),
  };
});

jest.mock('../../src/services/auth.service');
jest.mock('../../src/config', () => ({
  nodeEnv: 'test',
  port: 3001,
  jwtSecret: 'test-secret',
  frontendUrl: 'http://localhost:5173',
  userCacheTtl: 3600,
}));
jest.mock('@nyife/shared-utils', () => {
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
jest.mock('@nyife/shared-events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
  TOPICS: { EMAIL_SEND: 'email.send' },
}));

const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/services/auth.service');

const CSRF_COOKIE = 'csrfToken=test-csrf-token';
const CSRF_HEADER = { 'X-CSRF-Token': 'test-csrf-token' };

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/v1/auth/csrf-token', () => {
  it('should issue a csrf token cookie', async () => {
    const res = await request(app).get('/api/v1/auth/csrf-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
  });
});

// ─── POST /api/v1/auth/register ──────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  const validBody = {
    email: 'new@example.com',
    password: 'Secret1!',
    first_name: 'New',
    last_name: 'User',
    phone: '+1234567890',
  };

  it('should return 201 on successful registration', async () => {
    authService.register.mockResolvedValue({
      user: { id: 'u1', email: 'new@example.com', first_name: 'New' },
      emailVerificationToken: 'token-abc',
    });

    const res = await request(app).post('/api/v1/auth/register').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('new@example.com');
  });

  it('should return 400 on invalid body (missing email)', async () => {
    const res = await request(app).post('/api/v1/auth/register').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ password: 'Secret1!', first_name: 'A', last_name: 'B' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 409 when email exists', async () => {
    const err = new Error('A user with this email already exists');
    err.statusCode = 409;
    err.isOperational = true;
    authService.register.mockRejectedValue(err);

    const res = await request(app).post('/api/v1/auth/register').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/v1/auth/verify-email ─────────────────────────────────────────

describe('POST /api/v1/auth/verify-email', () => {
  it('should return 200 on valid token', async () => {
    authService.verifyEmail.mockResolvedValue({ id: 'u1', email: 'user@example.com', status: 'active' });

    const res = await request(app).post('/api/v1/auth/verify-email').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ token: 'valid-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on missing token', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({});

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/auth/login ─────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('should return 200 with tokens on success', async () => {
    authService.login.mockResolvedValue({
      accessToken: 'at-123',
      refreshToken: 'rt-123',
      user: { id: 'u1', email: 'user@example.com' },
    });

    const res = await request(app).post('/api/v1/auth/login').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ email: 'user@example.com', password: 'Secret1!' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('at-123');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should return 400 on invalid email format', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ email: 'bad', password: 'Secret1!' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/auth/refresh ───────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  it('should return 200 with new tokens', async () => {
    authService.refreshAccessToken.mockResolvedValue({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
      user: { id: 'u1' },
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [CSRF_COOKIE, 'refreshToken=old-rt'])
      .set(CSRF_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new-at');
  });

  it('should return 403 without a valid csrf token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=old-rt');

    expect(res.status).toBe(403);
  });
});

// ─── POST /api/v1/auth/logout ────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('should return 200', async () => {
    authService.logout.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer mock-token')
      .set('Cookie', CSRF_COOKIE)
      .set(CSRF_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /api/v1/auth/forgot-password ───────────────────────────────────────

describe('POST /api/v1/auth/forgot-password', () => {
  it('should return 200 regardless of email existence', async () => {
    authService.forgotPassword.mockResolvedValue({ resetToken: null });

    const res = await request(app).post('/api/v1/auth/forgot-password').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on invalid email', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ email: 'bad' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/v1/auth/reset-password ────────────────────────────────────────

describe('POST /api/v1/auth/reset-password', () => {
  it('should return 200 on success', async () => {
    authService.resetPassword.mockResolvedValue({ id: 'u1' });

    const res = await request(app).post('/api/v1/auth/reset-password').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ token: 'valid', new_password: 'NewPass1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on weak password', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').set('Cookie', CSRF_COOKIE).set(CSRF_HEADER).send({ token: 'valid', new_password: '123' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/auth/me ─────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('should return 200 with user profile', async () => {
    authService.getUserById.mockResolvedValue({ id: 'test-user-uuid', email: 'user@example.com' });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.user).toBeDefined();
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

describe('Unknown route', () => {
  it('should return 404', async () => {
    const res = await request(app).get('/api/v1/auth/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Health check ────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
