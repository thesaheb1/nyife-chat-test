'use strict';

const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;
const TEST_USER_EMAIL = 'user.test@example.com';
const TEST_ADMIN_EMAIL = 'admin.test@example.com';
const SHARED_TEST_PASSWORD = process.env.AUTH_TEST_PASSWORD;
const TEST_USER_PASSWORD = process.env.AUTH_TEST_USER_PASSWORD || SHARED_TEST_PASSWORD;
const TEST_ADMIN_PASSWORD = process.env.AUTH_TEST_ADMIN_PASSWORD || SHARED_TEST_PASSWORD;

function requireSeedPasswords() {
  if (TEST_USER_PASSWORD && TEST_ADMIN_PASSWORD) {
    return;
  }

  throw new Error(
    'Set AUTH_TEST_PASSWORD or both AUTH_TEST_USER_PASSWORD and AUTH_TEST_ADMIN_PASSWORD before running this seeder.'
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    requireSeedPasswords();

    const now = new Date();
    const [userPasswordHash, adminPasswordHash] = await Promise.all([
      bcrypt.hash(TEST_USER_PASSWORD, BCRYPT_ROUNDS),
      bcrypt.hash(TEST_ADMIN_PASSWORD, BCRYPT_ROUNDS),
    ]);

    await queryInterface.bulkInsert(
      'auth_users',
      [
        {
          id: '11111111-1111-4111-8111-111111111111',
          email: TEST_USER_EMAIL,
          password: userPasswordHash,
          first_name: 'Test',
          last_name: 'User',
          phone: '+10000000001',
          avatar_url: null,
          role: 'user',
          status: 'active',
          email_verified_at: now,
          email_verification_token: null,
          email_verification_expires: null,
          password_reset_token: null,
          password_reset_expires: null,
          last_login_at: null,
          last_login_ip: null,
          login_count: 0,
          google_id: null,
          facebook_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          email: TEST_ADMIN_EMAIL,
          password: adminPasswordHash,
          first_name: 'Test',
          last_name: 'Admin',
          phone: '+10000000002',
          avatar_url: null,
          role: 'super_admin',
          status: 'active',
          email_verified_at: now,
          email_verification_token: null,
          email_verification_expires: null,
          password_reset_token: null,
          password_reset_expires: null,
          last_login_at: null,
          last_login_ip: null,
          login_count: 0,
          google_id: null,
          facebook_id: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        },
      ],
      {
        updateOnDuplicate: [
          'password',
          'first_name',
          'last_name',
          'phone',
          'avatar_url',
          'role',
          'status',
          'email_verified_at',
          'email_verification_token',
          'email_verification_expires',
          'password_reset_token',
          'password_reset_expires',
          'last_login_at',
          'last_login_ip',
          'login_count',
          'google_id',
          'facebook_id',
          'updated_at',
          'deleted_at',
        ],
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('auth_users', {
      email: [TEST_USER_EMAIL, TEST_ADMIN_EMAIL],
    });
  },
};
