'use strict';

jest.mock('@nyife/shared-middleware', () => {
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
  }

  return {
    authenticate: (req, res, next) => {
      req.user = { id: 'test-user-uuid', role: 'user' };
      next();
    },
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

jest.mock('../../src/services/automation.service');
jest.mock('../../src/config', () => ({
  nodeEnv: 'test',
  port: 3010,
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
    generateUUID: jest.fn(() => 'test-uuid-1234'),
    getPagination: jest.fn((page, limit) => ({ offset: ((page || 1) - 1) * (limit || 20), limit: limit || 20 })),
    getPaginationMeta: jest.fn((total, page, limit) => ({ page: page || 1, limit: limit || 20, total, totalPages: Math.ceil(total / (limit || 20)) })),
  };
});

const request = require('supertest');
const app = require('../../src/app');
const automationService = require('../../src/services/automation.service');

const USER_ID = 'test-user-uuid';
const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

beforeEach(() => { jest.clearAllMocks(); });

// ─── POST /api/v1/automations ────────────────────────────────────────────────

describe('POST /api/v1/automations', () => {
  const validBody = {
    wa_account_id: VALID_UUID,
    name: 'My Automation',
    type: 'basic_reply',
    trigger_config: { trigger_type: 'exact', trigger_value: 'hello' },
    action_config: { message_type: 'text', content: 'Hi!' },
  };

  it('should return 201 on success', async () => {
    automationService.createAutomation.mockResolvedValue({ id: 'auto-1', name: 'My Automation', status: 'draft' });

    const res = await request(app)
      .post('/api/v1/automations')
      .set('x-user-id', USER_ID)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.automation.status).toBe('draft');
  });

  it('should return 400 on missing name', async () => {
    const res = await request(app)
      .post('/api/v1/automations')
      .set('x-user-id', USER_ID)
      .send({ wa_account_id: VALID_UUID, type: 'basic_reply' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/automations ─────────────────────────────────────────────────

describe('GET /api/v1/automations', () => {
  it('should return 200 with paginated automations', async () => {
    automationService.listAutomations.mockResolvedValue({
      automations: [{ id: 'auto-1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get('/api/v1/automations').set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.automations).toHaveLength(1);
  });
});

// ─── GET /api/v1/automations/:id ─────────────────────────────────────────────

describe('GET /api/v1/automations/:id', () => {
  it('should return 200 on found', async () => {
    automationService.getAutomation.mockResolvedValue({ id: VALID_UUID, name: 'Test' });

    const res = await request(app)
      .get(`/api/v1/automations/${VALID_UUID}`)
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
  });

  it('should return 404 when not found', async () => {
    const err = new Error('Automation not found');
    err.statusCode = 404;
    err.isOperational = true;
    automationService.getAutomation.mockRejectedValue(err);

    const res = await request(app)
      .get(`/api/v1/automations/${VALID_UUID}`)
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/v1/automations/:id ─────────────────────────────────────────────

describe('PUT /api/v1/automations/:id', () => {
  it('should return 200 on update', async () => {
    automationService.updateAutomation.mockResolvedValue({ id: VALID_UUID, name: 'Updated' });

    const res = await request(app)
      .put(`/api/v1/automations/${VALID_UUID}`)
      .set('x-user-id', USER_ID)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/v1/automations/:id ──────────────────────────────────────────

describe('DELETE /api/v1/automations/:id', () => {
  it('should return 200 on delete', async () => {
    automationService.deleteAutomation.mockResolvedValue({ id: VALID_UUID });

    const res = await request(app)
      .delete(`/api/v1/automations/${VALID_UUID}`)
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── PUT /api/v1/automations/:id/status ──────────────────────────────────────

describe('PUT /api/v1/automations/:id/status', () => {
  it('should return 200 on status change', async () => {
    automationService.updateAutomationStatus.mockResolvedValue({ id: VALID_UUID, status: 'active' });

    const res = await request(app)
      .put(`/api/v1/automations/${VALID_UUID}/status`)
      .set('x-user-id', USER_ID)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
  });

  it('should return 400 on invalid status', async () => {
    const res = await request(app)
      .put(`/api/v1/automations/${VALID_UUID}/status`)
      .set('x-user-id', USER_ID)
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/automations/:id/logs ────────────────────────────────────────

describe('GET /api/v1/automations/:id/logs', () => {
  it('should return 200 with logs', async () => {
    automationService.getAutomationLogs.mockResolvedValue({
      logs: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    const res = await request(app)
      .get(`/api/v1/automations/${VALID_UUID}/logs`)
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.logs).toEqual([]);
  });
});

// ─── Webhook Routes ──────────────────────────────────────────────────────────

describe('POST /api/v1/automations/webhooks', () => {
  it('should return 201 on success', async () => {
    automationService.createWebhook.mockResolvedValue({ id: 'wh-1', name: 'Test Webhook' });

    const res = await request(app)
      .post('/api/v1/automations/webhooks')
      .set('x-user-id', USER_ID)
      .send({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['message.received'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.webhook.name).toBe('Test Webhook');
  });

  it('should return 400 on invalid URL', async () => {
    const res = await request(app)
      .post('/api/v1/automations/webhooks')
      .set('x-user-id', USER_ID)
      .send({ name: 'Bad', url: 'not-a-url', events: ['msg'] });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/automations/webhooks', () => {
  it('should return 200 with webhooks', async () => {
    automationService.listWebhooks.mockResolvedValue({
      webhooks: [{ id: 'wh-1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get('/api/v1/automations/webhooks').set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.webhooks).toHaveLength(1);
  });
});

describe('GET /api/v1/automations/webhooks/:id', () => {
  it('should return 200 on found', async () => {
    automationService.getWebhook.mockResolvedValue({ id: VALID_UUID, name: 'Hook' });

    const res = await request(app)
      .get(`/api/v1/automations/webhooks/${VALID_UUID}`)
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/automations/webhooks/:id/test', () => {
  it('should return 200 on test success', async () => {
    automationService.testWebhook.mockResolvedValue({ success: true, status_code: 200 });

    const res = await request(app)
      .post(`/api/v1/automations/webhooks/${VALID_UUID}/test`)
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
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
    const res = await request(app).get('/api/v1/automations-nonexistent');
    expect(res.status).toBe(404);
  });
});
