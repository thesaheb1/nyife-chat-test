'use strict';

const request = require('supertest');

const TICKET_ID = '6bda5bcc-2058-4fee-884a-94a1c9f05a0d';
const ORGANIZATION_ID = 'd25c54fd-8cca-44a7-a015-3e4af0302675';
const USER_ID = '5850ac9c-ce2f-4413-a3c5-268529333744';

let currentTicket = null;

function buildTicket(overrides = {}) {
  const now = new Date('2026-03-17T10:00:00.000Z').toISOString();
  return {
    id: TICKET_ID,
    ticket_number: 'NYF-TKT-20260317-1001',
    user_id: USER_ID,
    organization_id: ORGANIZATION_ID,
    subject: 'Payment issue on support desk',
    description: 'Customer reported a billing issue.',
    category: 'billing',
    priority: 'medium',
    status: 'open',
    assigned_to: 'admin-1',
    assigned_at: now,
    resolved_at: null,
    closed_at: null,
    satisfaction_rating: null,
    satisfaction_feedback: null,
    last_message_at: now,
    last_message_preview: 'Customer reported a billing issue.',
    created_at: now,
    updated_at: now,
    deleted_at: null,
    update: jest.fn(async function updateTicket(updateData) {
      Object.assign(this, updateData, {
        updated_at: new Date('2026-03-17T10:05:00.000Z').toISOString(),
      });
      return this;
    }),
    ...overrides,
  };
}

function buildBootstrapRow(ticket) {
  return {
    ...ticket,
    creator_id: ticket.user_id,
    creator_email: 'customer@example.com',
    creator_first_name: 'Support',
    creator_last_name: 'Customer',
    creator_phone: '+919999999999',
    creator_avatar_url: null,
    creator_role: 'user',
    creator_status: 'active',
    organization_name: 'Default Organization',
    organization_slug: 'default-organization',
    organization_status: 'active',
    organization_logo_url: null,
    assigned_admin_id: ticket.assigned_to,
    assigned_admin_email: 'admin@example.com',
    assigned_admin_first_name: 'Admin',
    assigned_admin_last_name: 'Agent',
    assigned_admin_phone: null,
    assigned_admin_avatar_url: null,
    assigned_admin_role: 'admin',
    assigned_admin_status: 'active',
    message_count: 3,
  };
}

const mockFindOne = jest.fn();
const mockQuery = jest.fn();
const mockReplyCreate = jest.fn();

jest.mock('@nyife/shared-middleware', () => ({
  errorHandler: (err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code || null,
    });
  },
  organizationResolver: (req, _res, next) => {
    req.organizationId = ORGANIZATION_ID;
    req.user = { id: USER_ID, role: 'user' };
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

jest.mock('../../src/models', () => ({
  Ticket: {
    findOne: (...args) => mockFindOne(...args),
  },
  TicketReply: {
    create: (...args) => mockReplyCreate(...args),
  },
  TicketRead: {},
  sequelize: {
    query: (...args) => mockQuery(...args),
    transaction: async (callback) => callback(null),
  },
}));

const app = require('../../src/app');

describe('support workflow locking', () => {
  beforeEach(() => {
    currentTicket = buildTicket();
    mockFindOne.mockReset();
    mockQuery.mockReset();
    mockReplyCreate.mockReset();

    mockFindOne.mockImplementation(async ({ where }) => {
      if (!currentTicket) {
        return null;
      }

      if (where.id !== currentTicket.id) {
        return null;
      }

      if (Object.prototype.hasOwnProperty.call(where, 'deleted_at') && currentTicket.deleted_at !== where.deleted_at) {
        return null;
      }

      return currentTicket;
    });

    mockQuery.mockImplementation(async (sql) => {
      if (sql.includes('FROM support_tickets AS ticket')) {
        return [buildBootstrapRow(currentTicket)];
      }

      throw new Error(`Unexpected query in test: ${sql}`);
    });
  });

  it('blocks user replies on resolved tickets with a conflict code', async () => {
    currentTicket.status = 'resolved';

    const response = await request(app)
      .post(`/api/v1/support/tickets/${TICKET_ID}/reply`)
      .send({ body: 'Can you help again?' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUPPORT_TICKET_LOCKED');
    expect(response.body.message).toMatch(/locked for replies/i);
    expect(mockReplyCreate).not.toHaveBeenCalled();
  });

  it('blocks user replies on closed tickets with a conflict code', async () => {
    currentTicket.status = 'closed';

    const response = await request(app)
      .post(`/api/v1/support/tickets/${TICKET_ID}/reply`)
      .send({ body: 'Please reopen this.' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUPPORT_TICKET_LOCKED');
    expect(mockReplyCreate).not.toHaveBeenCalled();
  });

  it('blocks admin replies on resolved tickets with a conflict code', async () => {
    currentTicket.status = 'resolved';

    const response = await request(app)
      .post(`/api/v1/admin/support/tickets/${TICKET_ID}/reply`)
      .send({ body: 'Reply from admin.' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUPPORT_TICKET_LOCKED');
    expect(mockReplyCreate).not.toHaveBeenCalled();
  });

  it('blocks admin replies on closed tickets with a conflict code', async () => {
    currentTicket.status = 'closed';

    const response = await request(app)
      .post(`/api/v1/admin/support/tickets/${TICKET_ID}/reply`)
      .send({ body: 'Reply from admin.' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SUPPORT_TICKET_LOCKED');
    expect(mockReplyCreate).not.toHaveBeenCalled();
  });

  it('clears rating and feedback when an admin reopens a terminal ticket', async () => {
    currentTicket = buildTicket({
      status: 'resolved',
      resolved_at: new Date('2026-03-17T10:00:00.000Z').toISOString(),
      satisfaction_rating: 4,
      satisfaction_feedback: 'Very helpful support agent.',
    });

    const response = await request(app)
      .put(`/api/v1/admin/support/tickets/${TICKET_ID}/status`)
      .send({ status: 'open' });

    expect(response.status).toBe(200);
    expect(currentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'open',
        resolved_at: null,
        closed_at: null,
        satisfaction_rating: null,
        satisfaction_feedback: null,
      })
    );
    expect(response.body.data.ticket.status).toBe('open');
    expect(response.body.data.ticket.satisfaction_rating).toBeNull();
    expect(response.body.data.ticket.satisfaction_feedback).toBeNull();
  });
});
