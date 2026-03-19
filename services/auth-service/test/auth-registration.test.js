'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const crypto = require('crypto');

const authService = require('../src/services/auth.service');
const { User, sequelize } = require('../src/models');

afterEach(() => {
  mock.restoreAll();
});

describe('auth-service registration', () => {
  it('reuses a pending unverified account when the same email registers again', async () => {
    const queryCalls = [];
    let emailPayload = null;

    const existingUser = {
      id: 'user-1',
      email: 'owner@example.com',
      first_name: 'Wrong',
      last_name: 'Entry',
      phone: '+919999999999',
      role: 'user',
      status: 'pending_verification',
      email_verified_at: null,
      must_change_password: true,
      async update(payload) {
        Object.assign(this, payload);
        return this;
      },
      toSafeJSON() {
        return {
          id: this.id,
          email: this.email,
          first_name: this.first_name,
          last_name: this.last_name,
          phone: this.phone,
          role: this.role,
          status: this.status,
          must_change_password: this.must_change_password,
          email_verified_at: this.email_verified_at,
        };
      },
    };

    mock.method(crypto, 'randomBytes', () => ({
      toString: () => 'replacement-token',
    }));
    mock.method(User, 'unscoped', () => ({
      findOne: async ({ where }) => {
        assert.equal(where.email, 'owner@example.com');
        return existingUser;
      },
    }));
    mock.method(User, 'create', async () => {
      throw new Error('User.create should not be called when reusing a pending registration');
    });
    mock.method(sequelize, 'transaction', async (callback) => callback({ id: 'tx-1' }));
    mock.method(sequelize, 'query', async (sql, options = {}) => {
      queryCalls.push({ sql, options });

      if (sql.includes('FROM org_organizations')) {
        return [[{ id: 'org-1' }], null];
      }

      if (sql.includes('UPDATE org_organizations')) {
        assert.equal(options.replacements.userId, 'user-1');
        assert.equal(options.replacements.organizationId, 'org-1');
        return [[], null];
      }

      if (sql.includes('FROM wallet_wallets')) {
        return [[{ id: 'wallet-1' }], null];
      }

      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });
    mock.method(global, 'fetch', async (_url, options = {}) => {
      emailPayload = JSON.parse(options.body);
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            data: {
              emails: [{ status: 'sent' }],
            },
          });
        },
      };
    });

    const result = await authService.register({
      email: 'owner@example.com',
      password: 'StrongPass1!',
      first_name: 'Saheb',
      last_name: 'Owner',
      phone: '+918888888888',
    });

    assert.equal(existingUser.first_name, 'Saheb');
    assert.equal(existingUser.last_name, 'Owner');
    assert.equal(existingUser.phone, '+918888888888');
    assert.equal(existingUser.email_verification_token, 'replacement-token');
    assert.equal(existingUser.status, 'pending_verification');
    assert.equal(existingUser.must_change_password, false);
    assert.equal(existingUser.password_reset_token, null);
    assert.equal(result.user.email, 'owner@example.com');
    assert.equal(result.user.first_name, 'Saheb');
    assert.equal(result.emailVerificationToken, 'replacement-token');
    assert.equal(emailPayload.to_emails[0], 'owner@example.com');
    assert.match(emailPayload.variables.verificationUrl, /replacement-token/);
    assert.ok(queryCalls.some((entry) => entry.sql.includes('UPDATE org_organizations')));
  });
});
