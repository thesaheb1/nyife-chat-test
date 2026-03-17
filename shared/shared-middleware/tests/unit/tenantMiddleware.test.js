'use strict';

const { AppError } = require('@nyife/shared-utils');
const {
  organizationResolver,
  organizationParamResolver,
} = require('../../src/tenantMiddleware');

describe('tenantMiddleware', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.ORGANIZATION_SERVICE_URL = 'http://organization-service:3011';
  });

  afterEach(() => {
    delete process.env.ORGANIZATION_SERVICE_URL;
    delete global.fetch;
    jest.clearAllMocks();
  });

  it('organizationResolver resolves context from X-Organization-Id', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          organization: { id: 'org-header' },
          membership: null,
          role: 'owner',
          permissions: { resources: { wallet: { read: true } } },
        },
      }),
    });

    const req = {
      headers: { 'x-organization-id': 'org-header' },
      user: { id: 'user-1', role: 'user' },
    };
    const next = jest.fn();

    await organizationResolver(req, {}, next);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://organization-service:3011/api/v1/organizations/internal/context/resolve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          user_id: 'user-1',
          organization_id: 'org-header',
        }),
      })
    );
    expect(req.organizationId).toBe('org-header');
    expect(req.tenantId).toBe('org-header');
    expect(req.user.organizationRole).toBe('owner');
    expect(next).toHaveBeenCalledWith();
  });

  it('organizationParamResolver resolves context from the route param instead of the header', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          organization: { id: 'org-param' },
          membership: { id: 'membership-1' },
          role: 'team',
          permissions: { resources: { team_members: { read: true } } },
        },
      }),
    });

    const req = {
      params: { id: 'org-param' },
      headers: { 'x-organization-id': 'org-header' },
      user: { id: 'user-1', role: 'user' },
    };
    const next = jest.fn();

    await organizationParamResolver('id')(req, {}, next);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://organization-service:3011/api/v1/organizations/internal/context/resolve',
      expect.objectContaining({
        body: JSON.stringify({
          user_id: 'user-1',
          organization_id: 'org-param',
        }),
      })
    );
    expect(req.organizationId).toBe('org-param');
    expect(req.organizationMembership).toEqual({ id: 'membership-1' });
    expect(req.user.organizationRole).toBe('team');
    expect(next).toHaveBeenCalledWith();
  });

  it('organizationParamResolver returns a bad request when the route param is missing', async () => {
    const req = {
      params: {},
      headers: {},
      user: { id: 'user-1', role: 'user' },
    };
    const next = jest.fn();

    await organizationParamResolver('id')(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'ORG_ID_REQUIRED',
      })
    );
  });

  it('organizationParamResolver surfaces forbidden context failures', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden' }),
    });

    const req = {
      params: { id: 'org-param' },
      headers: {},
      user: { id: 'user-1', role: 'user' },
    };
    const next = jest.fn();

    await organizationParamResolver('id')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 403,
      code: 'ORG_CONTEXT_FORBIDDEN',
    });
  });
});
