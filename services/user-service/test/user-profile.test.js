'use strict';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');

const userService = require('../src/services/user.service');
const { sequelize } = require('../src/models');

afterEach(() => {
  mock.restoreAll();
});

describe('user-service profile updates', () => {
  it('rejects a phone update when another active user already owns the phone number', async () => {
    mock.method(sequelize, 'query', async (sql, options = {}) => {
      if (sql.includes('FROM auth_users') && sql.includes('WHERE phone = :phone')) {
        assert.equal(options.replacements.phone, '+919888888888');
        assert.equal(options.replacements.excludeUserId, 'user-1');
        return [[{ id: 'user-2', email: 'occupied@example.com' }], null];
      }

      throw new Error(`Unexpected sequelize.query SQL: ${sql}`);
    });

    await assert.rejects(
      userService.updateProfile('user-1', {
        first_name: 'Saheb',
        last_name: 'Ali',
        phone: '+919888888888',
      }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'PHONE_ALREADY_EXISTS');
        assert.equal(error.message, 'A user with this phone number already exists');
        return true;
      }
    );
  });
});
