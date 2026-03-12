'use strict';

jest.mock('../../src/services/admin.service', () => ({
  resolveAdminAuthorization: jest.fn(),
}));

const { superAdminOnly } = require('../../src/middlewares/adminRbac');

describe('adminRbac middleware', () => {
  it('attaches a top-level actor id for super admins', () => {
    const req = {
      headers: {
        'x-user-id': 'super-admin-1',
        'x-user-role': 'super_admin',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    superAdminOnly(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.adminUser).toEqual(
      expect.objectContaining({
        id: 'super-admin-1',
        user_id: 'super-admin-1',
        actor_type: 'super_admin',
        is_super_admin: true,
      })
    );
  });
});
