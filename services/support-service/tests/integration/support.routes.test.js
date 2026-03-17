'use strict';

const request = require('supertest');

const middlewareCounts = {
  organizationResolver: 0,
};

const mockControllerMocks = new Proxy(
  {},
  {
    get(target, prop) {
      if (!target[prop]) {
        target[prop] = jest.fn((req, res) => {
          res.status(200).json({
            success: true,
            route: String(prop),
            params: req.params,
          });
        });
      }

      return target[prop];
    },
  }
);

jest.mock('@nyife/shared-middleware', () => ({
  errorHandler: (err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code || null,
    });
  },
  organizationResolver: (req, _res, next) => {
    middlewareCounts.organizationResolver += 1;
    req.organizationId = req.headers['x-organization-id'] || 'org-1';
    req.user = { id: 'user-1', role: 'user' };
    next();
  },
  asyncHandler: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
  rbac: () => (_req, _res, next) => next(),
  adminRbac: () => (req, _res, next) => {
    req.adminUser = {
      id: 'admin-1',
      user: { id: 'admin-1' },
      is_super_admin: true,
      permissions: { resources: { support: { read: true, update: true, delete: true } } },
    };
    next();
  },
}));

jest.mock('../../src/controllers/support.controller', () => mockControllerMocks);

const app = require('../../src/app');

describe('support routes', () => {
  beforeEach(() => {
    middlewareCounts.organizationResolver = 0;
    Object.values(mockControllerMocks).forEach((mockFn) => mockFn.mockClear?.());
  });

  it('routes user unread-count to getUnreadCount instead of getTicket', async () => {
    const response = await request(app).get('/api/v1/support/tickets/unread-count');

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('getUnreadCount');
    expect(mockControllerMocks.getUnreadCount).toHaveBeenCalledTimes(1);
    expect(mockControllerMocks.getTicket).not.toHaveBeenCalled();
    expect(middlewareCounts.organizationResolver).toBe(1);
  });

  it('routes user ticket messages to getTicketMessages', async () => {
    const ticketId = '6bda5bcc-2058-4fee-884a-94a1c9f05a0d';
    const response = await request(app).get(`/api/v1/support/tickets/${ticketId}/messages?page=1&limit=30`);

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('getTicketMessages');
    expect(response.body.params.id).toBe(ticketId);
    expect(mockControllerMocks.getTicketMessages).toHaveBeenCalledTimes(1);
  });

  it('routes user mark-read to markTicketRead', async () => {
    const ticketId = '6bda5bcc-2058-4fee-884a-94a1c9f05a0d';
    const response = await request(app).post(`/api/v1/support/tickets/${ticketId}/read`);

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('markTicketRead');
    expect(response.body.params.id).toBe(ticketId);
    expect(mockControllerMocks.markTicketRead).toHaveBeenCalledTimes(1);
  });

  it('routes admin assignable-admins to getAssignableAdmins instead of adminGetTicket', async () => {
    const response = await request(app).get('/api/v1/admin/support/tickets/assignable-admins');

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('getAssignableAdmins');
    expect(mockControllerMocks.getAssignableAdmins).toHaveBeenCalledTimes(1);
    expect(mockControllerMocks.adminGetTicket).not.toHaveBeenCalled();
  });

  it('routes admin ticket messages to adminGetTicketMessages', async () => {
    const ticketId = '6bda5bcc-2058-4fee-884a-94a1c9f05a0d';
    const response = await request(app).get(
      `/api/v1/admin/support/tickets/${ticketId}/messages?page=1&limit=30`
    );

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('adminGetTicketMessages');
    expect(response.body.params.id).toBe(ticketId);
    expect(mockControllerMocks.adminGetTicketMessages).toHaveBeenCalledTimes(1);
  });

  it('routes admin mark-read to adminMarkTicketRead', async () => {
    const ticketId = '6bda5bcc-2058-4fee-884a-94a1c9f05a0d';
    const response = await request(app).post(`/api/v1/admin/support/tickets/${ticketId}/read`);

    expect(response.status).toBe(200);
    expect(response.body.route).toBe('adminMarkTicketRead');
    expect(response.body.params.id).toBe(ticketId);
    expect(mockControllerMocks.adminMarkTicketRead).toHaveBeenCalledTimes(1);
  });
});
