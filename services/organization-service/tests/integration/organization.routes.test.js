'use strict';

const request = require('supertest');

const middlewareCounts = {
  organizationResolver: 0,
  organizationParamResolver: 0,
};

jest.mock('@nyife/shared-middleware', () => {
  const { AppError } = require('@nyife/shared-utils');

  return {
    requestLogger: (_req, _res, next) => next(),
    errorHandler: (err, _req, res, _next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        code: err.code || null,
      });
    },
    authenticate: (req, _res, next) => {
      req.user = { id: 'user-1', role: 'user' };
      next();
    },
    authenticateOptional: (req, _res, next) => next(),
    organizationResolver: (req, _res, next) => {
      middlewareCounts.organizationResolver += 1;
      req.organizationId = req.headers['x-organization-id'] || 'header-org';
      req.user = {
        ...(req.user || {}),
        organizationRole: 'owner',
        permissions: { resources: { organizations: { read: true, create: true, update: true, delete: true } } },
      };
      next();
    },
    organizationParamResolver: (paramName = 'id') => (req, _res, next) => {
      middlewareCounts.organizationParamResolver += 1;
      req.organizationId = req.params[paramName];
      req.user = {
        ...(req.user || {}),
        organizationRole: 'owner',
        permissions: { resources: { organizations: { read: true, create: true, update: true, delete: true } } },
      };
      next();
    },
    asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
    requireActiveSubscription: () => (_req, _res, next) => next(),
    rbac: () => (_req, _res, next) => next(),
    AppError,
  };
});

const mockControllerMocks = new Proxy({}, {
  get(target, prop) {
    if (!target[prop]) {
      target[prop] = jest.fn((req, res) => {
        res.status(200).json({
          success: true,
          route: String(prop),
          organizationId: req.organizationId || null,
        });
      });
    }

    return target[prop];
  },
});

jest.mock('../../src/controllers/organization.controller', () => mockControllerMocks);

const app = require('../../src/app');

describe('organization routes middleware wiring', () => {
  beforeEach(() => {
    middlewareCounts.organizationResolver = 0;
    middlewareCounts.organizationParamResolver = 0;
    Object.values(mockControllerMocks).forEach((mockFn) => mockFn.mockClear?.());
  });

  it('GET /api/v1/organizations/me does not invoke organizationResolver', async () => {
    const response = await request(app)
      .get('/api/v1/organizations/me')
      .set('X-Organization-Id', 'stale-org-id');

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('getMyOrganizations');
    expect(response.body.organizationId).toBeNull();
    expect(middlewareCounts.organizationResolver).toBe(0);
    expect(middlewareCounts.organizationParamResolver).toBe(0);
  });

  it('GET /api/v1/organizations does not invoke organizationResolver', async () => {
    const response = await request(app)
      .get('/api/v1/organizations')
      .set('X-Organization-Id', 'stale-org-id');

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('listOrganizations');
    expect(response.body.organizationId).toBeNull();
    expect(middlewareCounts.organizationResolver).toBe(0);
    expect(middlewareCounts.organizationParamResolver).toBe(0);
  });

  it('GET /api/v1/organizations/:id uses organizationParamResolver instead of organizationResolver', async () => {
    const response = await request(app)
      .get('/api/v1/organizations/org-123')
      .set('X-Organization-Id', 'stale-org-id');

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('getOrganization');
    expect(response.body.organizationId).toBe('org-123');
    expect(middlewareCounts.organizationResolver).toBe(0);
    expect(middlewareCounts.organizationParamResolver).toBe(1);
  });
});
