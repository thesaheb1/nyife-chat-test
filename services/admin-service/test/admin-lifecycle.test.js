'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const adminService = require('../src/services/admin.service');
const adminUserService = require('../src/services/adminUser.service');
const {
  sequelize,
  AdminRole,
  SubAdmin,
  AdminInvitation,
  AdminUserInvitation,
} = require('../src/models');

afterEach(() => {
  mock.restoreAll();
});

describe('admin-service lifecycle', () => {
  it('recreates a sub-admin after purging a reusable legacy auth user', async () => {
    const legacyEmail = 'recreate@example.com';
    const legacyUserId = 'legacy-user';
    const inviteDestroyCalls = [];
    const queryCalls = [];
    let findByPkCount = 0;

    mock.method(AdminRole, 'findByPk', async () => ({
      id: 'role-1',
      title: 'Support Admin',
      permissions: { users: ['read'] },
      is_system: false,
    }));
    mock.method(bcrypt, 'hash', async () => 'hashed-password');
    mock.method(SubAdmin, 'count', async () => 0);
    mock.method(AdminInvitation, 'destroy', async (options) => {
      inviteDestroyCalls.push(options);
      return 1;
    });
    mock.method(SubAdmin, 'create', async (payload) => ({ id: 'sub-admin-1', ...payload }));
    mock.method(SubAdmin, 'findByPk', async () => {
      findByPkCount += 1;
      if (findByPkCount !== 1) {
        throw new Error(`Unexpected SubAdmin.findByPk call #${findByPkCount}`);
      }

      return {
        id: 'sub-admin-1',
        user_id: 'new-admin-user',
        role_id: 'role-1',
        status: 'active',
        role: {
          id: 'role-1',
          title: 'Support Admin',
          permissions: { users: ['read'] },
          is_system: false,
        },
        toJSON() {
          return {
            id: this.id,
            user_id: this.user_id,
            role_id: this.role_id,
            status: this.status,
          };
        },
      };
    });

    mock.method(sequelize, 'transaction', async () => ({
      commit: async () => undefined,
      rollback: async () => undefined,
    }));

    mock.method(sequelize, 'query', async (sql, options = {}) => {
      queryCalls.push({ sql, options });

      if (sql.includes('FROM auth_users') && sql.includes('ORDER BY created_at DESC')) {
        return [
          {
            id: legacyUserId,
            email: legacyEmail,
            role: 'admin',
            status: 'inactive',
            deleted_at: null,
          },
        ];
      }

      if (sql.includes('FROM auth_users') && sql.includes('WHERE email = :email') && sql.includes('deleted_at IS NULL')) {
        return [];
      }

      if (sql.includes('UPDATE support_tickets')) {
        return [];
      }

      if (sql.includes('DELETE FROM auth_users')) {
        assert.equal(options.replacements.userId, legacyUserId);
        return [];
      }

      if (sql.includes('INSERT INTO auth_users')) {
        assert.equal(options.replacements.email, legacyEmail);
        assert.equal(options.replacements.password, 'hashed-password');
        return [];
      }

      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });

    const result = await adminService.createSubAdmin(
      {
        first_name: 'Jane',
        last_name: 'Doe',
        email: legacyEmail,
        phone: null,
        password: 'Temp123!',
        role_id: 'role-1',
      },
      'super-admin-1'
    );

    assert.equal(result.user.email, legacyEmail);
    assert.equal(result.status, 'active');
    assert.equal(inviteDestroyCalls.length, 2);
    assert.ok(queryCalls.some((entry) => entry.sql.includes('DELETE FROM auth_users')));
    assert.ok(queryCalls.some((entry) => entry.sql.includes('INSERT INTO auth_users')));
  });

  it('syncs auth status and revokes sessions when a sub-admin is set inactive', async () => {
    const queries = [];
    let findByPkCount = 0;
    const subAdmin = {
      id: 'sub-admin-1',
      user_id: 'auth-user-1',
      role_id: 'role-1',
      status: 'active',
      role: {
        id: 'role-1',
        title: 'Ops',
        permissions: { support: ['read'] },
        is_system: false,
      },
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
      toJSON() {
        return {
          id: this.id,
          user_id: this.user_id,
          role_id: this.role_id,
          status: this.status,
        };
      },
    };

    mock.method(SubAdmin, 'findByPk', async () => {
      findByPkCount += 1;
      if (findByPkCount > 2) {
        throw new Error(`Unexpected SubAdmin.findByPk call #${findByPkCount}`);
      }

      return subAdmin;
    });
    mock.method(sequelize, 'transaction', async (callback) => callback({ id: 'tx-1' }));
    mock.method(sequelize, 'query', async (sql, options = {}) => {
      queries.push({ sql, options });

      if (sql.includes('UPDATE auth_users')) {
        assert.equal(options.replacements.status, 'inactive');
        return [];
      }

      if (sql.includes('UPDATE support_tickets')) {
        return [];
      }

      if (sql.includes('UPDATE auth_refresh_tokens')) {
        assert.equal(options.replacements.userId, 'auth-user-1');
        return [];
      }

      if (sql.includes('SELECT id, email, first_name, last_name, phone, status FROM auth_users')) {
        return [
          {
            id: 'auth-user-1',
            email: 'inactive@example.com',
            first_name: 'Ina',
            last_name: 'Ctive',
            phone: null,
            status: 'inactive',
          },
        ];
      }

      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });

    const updated = await adminService.updateSubAdmin('sub-admin-1', { status: 'inactive' });

    assert.equal(updated.status, 'inactive');
    assert.equal(updated.user?.status, 'inactive');
    assert.ok(queries.some((entry) => entry.sql.includes('UPDATE auth_users')));
    assert.ok(queries.some((entry) => entry.sql.includes('UPDATE auth_refresh_tokens')));
    assert.ok(queries.some((entry) => entry.sql.includes('UPDATE support_tickets')));
  });

  it('reopens revoked sub-admin invitations and hard-deletes invitation rows separately', async () => {
    let deleteOptions = null;
    const invitation = {
      id: 'invite-1',
      email: 'subadmin@example.com',
      status: 'revoked',
      role_title: 'Support Admin',
      role: { is_system: false, title: 'Support Admin' },
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
      async destroy(options) {
        deleteOptions = options;
        this.deleted = true;
      },
    };

    mock.method(AdminInvitation, 'update', async () => [0]);
    mock.method(AdminInvitation, 'findByPk', async () => invitation);
    mock.method(crypto, 'randomBytes', () => ({
      toString: () => 'fresh-sub-admin-token',
    }));

    const resent = await adminService.resendSubAdminInvitation('invite-1', 'super-admin-1');
    assert.equal(resent.status, 'pending');
    assert.equal(resent.invite_token, 'fresh-sub-admin-token');
    assert.equal(resent.invited_by_user_id, 'super-admin-1');

    await adminService.deleteSubAdminInvitation('invite-1');
    assert.equal(invitation.deleted, true);
    assert.deepEqual(deleteOptions, { force: true });
  });

  it('reopens revoked admin-user invitations and keeps revoke/delete distinct', async () => {
    let deleteOptions = null;
    const invitation = {
      id: 'invite-user-1',
      email: 'user@example.com',
      status: 'revoked',
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
      async destroy(options) {
        deleteOptions = options;
        this.deleted = true;
      },
      toJSON() {
        return {
          id: this.id,
          email: this.email,
          status: this.status,
          invite_token: this.invite_token,
        };
      },
    };

    mock.method(AdminUserInvitation, 'update', async () => [0]);
    mock.method(AdminUserInvitation, 'findByPk', async () => invitation);

    const resent = await adminUserService.resendUserInvitation('invite-user-1', 'admin-1');
    assert.equal(resent.status, 'pending');
    assert.equal(resent.id, 'invite-user-1');

    const revoked = await adminUserService.revokeUserInvitation('invite-user-1');
    assert.equal(revoked.status, 'revoked');

    await adminUserService.deleteUserInvitation('invite-user-1');
    assert.equal(invitation.deleted, true);
    assert.deepEqual(deleteOptions, { force: true });
  });

  it('hard-deletes sub-admin rows when an account is removed', async () => {
    let deleteOptions = null;
    const inviteDestroyCalls = [];
    const subAdmin = {
      id: 'sub-admin-1',
      user_id: 'auth-user-1',
      async destroy(options) {
        deleteOptions = options;
      },
    };

    mock.method(SubAdmin, 'findByPk', async () => subAdmin);
    mock.method(AdminInvitation, 'destroy', async (options) => {
      inviteDestroyCalls.push(options);
      return 1;
    });
    mock.method(sequelize, 'transaction', async () => ({
      commit: async () => undefined,
      rollback: async () => undefined,
    }));
    mock.method(sequelize, 'query', async (sql, options = {}) => {
      if (sql.includes('SELECT id, email, role, status, first_name, last_name, phone')) {
        return [{
          id: 'auth-user-1',
          email: 'subadmin@example.com',
          role: 'admin',
          status: 'active',
          first_name: 'Sub',
          last_name: 'Admin',
          phone: null,
        }];
      }

      if (sql.includes('UPDATE support_tickets')) {
        return [];
      }

      if (sql.includes('DELETE FROM auth_users')) {
        assert.equal(options.replacements.userId, 'auth-user-1');
        return [];
      }

      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });

    await adminService.deleteSubAdmin('sub-admin-1');

    assert.equal(deleteOptions?.force, true);
    assert.ok(inviteDestroyCalls.every((call) => call.force === true));
  });

  it('hard-deletes platform users and stamps access-token revocation state', async () => {
    const redisCalls = [];
    const queryCalls = [];
    const redis = {
      async del(key) {
        redisCalls.push(['del', key]);
      },
      async set(...args) {
        redisCalls.push(['set', ...args]);
      },
    };

    mock.method(sequelize, 'transaction', async (callback) => callback({ id: 'tx-1' }));
    mock.method(sequelize, 'query', async (sql, options = {}) => {
      queryCalls.push({ sql, options });

      if (sql.includes('FROM auth_users') && sql.includes('deleted_at IS NULL')) {
        return [{ id: 'user-1', role: 'user' }];
      }

      if (sql.includes('FROM org_organizations AS o')) {
        return [{
          id: 'org-1',
          user_id: 'user-1',
          name: 'Acme',
          slug: 'acme',
          description: null,
          logo_url: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
          wallet_balance: 0,
          current_plan: null,
          subscription_status: null,
          team_members_count: 0,
        }];
      }

      if (sql.includes('FROM sub_subscriptions')) {
        return [];
      }

      if (sql.includes('FROM wallet_wallets')) {
        return [{ balance: 0 }];
      }

      if (sql.includes('DELETE FROM org_invitations')) {
        assert.deepEqual(options.replacements.organizationIds, ['org-1']);
        return [];
      }

      if (sql.includes('DELETE FROM auth_users')) {
        assert.equal(options.replacements.userId, 'user-1');
        return [];
      }

      if (sql.includes('UPDATE auth_refresh_tokens')) {
        return [];
      }

      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });

    await adminUserService.deleteUser('user-1', { redis });

    assert.ok(queryCalls.some((entry) => entry.sql.includes('DELETE FROM auth_users')));
    assert.ok(redisCalls.some((call) => call[0] === 'del' && call[1] === 'user:user-1'));
    assert.ok(
      redisCalls.some(
        (call) =>
          call[0] === 'set'
          && call[1] === 'auth:access-revoked-after:user-1'
          && call[3] === 'EX'
      )
    );
  });
});
