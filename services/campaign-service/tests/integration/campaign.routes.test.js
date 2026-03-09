'use strict';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}), { virtual: true });

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

jest.mock('../../src/services/campaign.service');
jest.mock('../../src/config', () => ({
  nodeEnv: 'test',
  port: 3007,
  subscriptionServiceUrl: 'http://subscription:3003',
  templateServiceUrl: 'http://template:3006',
  walletServiceUrl: 'http://wallet:3004',
  contactServiceUrl: 'http://contact:3005',
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
    generateUUID: jest.fn(() => 'test-uuid-1234'),
    getPagination: jest.fn((page, limit) => ({ offset: ((page || 1) - 1) * (limit || 20), limit: limit || 20 })),
    getPaginationMeta: jest.fn((total, page, limit) => ({ page: page || 1, limit: limit || 20, total, totalPages: Math.ceil(total / (limit || 20)) })),
  };
});

const request = require('supertest');
const app = require('../../src/app');
const campaignService = require('../../src/services/campaign.service');

const USER_ID = 'test-user-uuid';

beforeEach(() => { jest.clearAllMocks(); });

// ─── POST /api/v1/campaigns ──────────────────────────────────────────────────

describe('POST /api/v1/campaigns', () => {
  const validBody = {
    name: 'Test Campaign',
    wa_account_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    template_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
    target_type: 'contacts',
    target_config: { contact_ids: ['a1b2c3d4-e5f6-7890-abcd-ef1234567892', 'a1b2c3d4-e5f6-7890-abcd-ef1234567893'] },
  };

  it('should return 201 on success', async () => {
    campaignService.createCampaign.mockResolvedValue({ id: 'camp-1', name: 'Test Campaign', status: 'draft' });

    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('x-user-id', USER_ID)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campaign.status).toBe('draft');
  });

  it('should return 400 on missing name', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns')
      .set('x-user-id', USER_ID)
      .send({ wa_account_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', template_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891' });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/campaigns ───────────────────────────────────────────────────

describe('GET /api/v1/campaigns', () => {
  it('should return 200 with paginated campaigns', async () => {
    campaignService.listCampaigns.mockResolvedValue({
      campaigns: [{ id: 'camp-1' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app).get('/api/v1/campaigns').set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.data.campaigns).toHaveLength(1);
  });
});

// ─── GET /api/v1/campaigns/:id ───────────────────────────────────────────────

describe('GET /api/v1/campaigns/:id', () => {
  it('should return 200 on found', async () => {
    campaignService.getCampaign.mockResolvedValue({ id: 'camp-1', name: 'Test' });

    const res = await request(app)
      .get('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
  });

  it('should return 404 when not found', async () => {
    const err = new Error('Campaign not found');
    err.statusCode = 404;
    err.isOperational = true;
    campaignService.getCampaign.mockRejectedValue(err);

    const res = await request(app)
      .get('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/v1/campaigns/:id ───────────────────────────────────────────────

describe('PUT /api/v1/campaigns/:id', () => {
  it('should return 200 on update', async () => {
    campaignService.updateCampaign.mockResolvedValue({ id: 'camp-1', name: 'Updated' });

    const res = await request(app)
      .put('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('x-user-id', USER_ID)
      .send({ name: 'Updated' });

    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/v1/campaigns/:id ────────────────────────────────────────────

describe('DELETE /api/v1/campaigns/:id', () => {
  it('should return 200 on delete', async () => {
    campaignService.deleteCampaign.mockResolvedValue({ id: 'camp-1' });

    const res = await request(app)
      .delete('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST /api/v1/campaigns/:id/start ────────────────────────────────────────

describe('POST /api/v1/campaigns/:id/start', () => {
  it('should return 200 on start', async () => {
    campaignService.startCampaign.mockResolvedValue({ id: 'camp-1', status: 'running' });

    const res = await request(app)
      .post('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890/start')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/v1/campaigns/:id/pause ────────────────────────────────────────

describe('POST /api/v1/campaigns/:id/pause', () => {
  it('should return 200 on pause', async () => {
    campaignService.pauseCampaign.mockResolvedValue({ id: 'camp-1', status: 'paused' });

    const res = await request(app)
      .post('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890/pause')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
  });
});

// ─── POST /api/v1/campaigns/:id/cancel ───────────────────────────────────────

describe('POST /api/v1/campaigns/:id/cancel', () => {
  it('should return 200 on cancel', async () => {
    campaignService.cancelCampaign.mockResolvedValue({ id: 'camp-1', status: 'cancelled' });

    const res = await request(app)
      .post('/api/v1/campaigns/a1b2c3d4-e5f6-7890-abcd-ef1234567890/cancel')
      .set('x-user-id', USER_ID);

    expect(res.status).toBe(200);
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
    const res = await request(app).get('/api/v1/campaigns-nonexistent');
    expect(res.status).toBe(404);
  });
});
