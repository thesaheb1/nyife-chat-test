'use strict';

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const BCRYPT_ROUNDS = 12;
const DEFAULT_ADMIN_EMAIL = 'admin@nyife.com';
const DEFAULT_ADMIN_PASSWORD = 'Admin123!@#';
const DEFAULT_ADMIN_FIRST_NAME = 'Super';
const DEFAULT_ADMIN_LAST_NAME = 'Admin';

function normalizeEmail(value) {
  return String(value || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

function normalizeString(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizePhone(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function getAdminSeedConfig() {
  return {
    email: normalizeEmail(process.env.ADMIN_SEED_EMAIL),
    password: normalizeString(process.env.ADMIN_SEED_PASSWORD, DEFAULT_ADMIN_PASSWORD),
    firstName: normalizeString(process.env.ADMIN_SEED_FIRST_NAME, DEFAULT_ADMIN_FIRST_NAME),
    lastName: normalizeString(process.env.ADMIN_SEED_LAST_NAME, DEFAULT_ADMIN_LAST_NAME),
    phone: normalizePhone(process.env.ADMIN_SEED_PHONE),
  };
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const admin = getAdminSeedConfig();
    const hashedPassword = await bcrypt.hash(admin.password, BCRYPT_ROUNDS);

    const existingUsers = await queryInterface.sequelize.query(
      `SELECT id, role
       FROM auth_users
       WHERE email = :email
       LIMIT 1`,
      {
        replacements: { email: admin.email },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    const existingUser = existingUsers[0];

    if (existingUser && existingUser.role !== 'super_admin') {
      throw new Error(
        `Cannot seed admin account for ${admin.email}. Existing auth user has role "${existingUser.role}". Use a different ADMIN_SEED_EMAIL or update that account manually.`
      );
    }

    if (existingUser) {
      await queryInterface.bulkUpdate(
        'auth_users',
        {
          password: hashedPassword,
          must_change_password: false,
          first_name: admin.firstName,
          last_name: admin.lastName,
          phone: admin.phone,
          role: 'super_admin',
          status: 'active',
          email_verified_at: now,
          email_verification_token: null,
          email_verification_expires: null,
          password_reset_token: null,
          password_reset_expires: null,
          deleted_at: null,
          updated_at: now,
        },
        { id: existingUser.id }
      );
      return;
    }

    await queryInterface.bulkInsert('auth_users', [
      {
        id: uuidv4(),
        email: admin.email,
        password: hashedPassword,
        must_change_password: false,
        first_name: admin.firstName,
        last_name: admin.lastName,
        phone: admin.phone,
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
    ]);
  },

  async down(queryInterface) {
    const admin = getAdminSeedConfig();
    await queryInterface.bulkDelete(
      'auth_users',
      {
        email: admin.email,
        role: 'super_admin',
      },
      {}
    );
  },
};
