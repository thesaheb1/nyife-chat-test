'use strict';

const bcrypt = require('bcrypt');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { QueryTypes } = require('sequelize');

const { sequelize, AdminRole, SubAdmin, AdminSetting } = require('../models');
const { AppError } = require('@nyife/shared-middleware');
const { getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');

const BCRYPT_ROUNDS = 12;

// ===========================================================================
// SUB-ADMIN MANAGEMENT
// ===========================================================================

/**
 * Creates a new sub-admin account.
 * 1. Verifies the role exists
 * 2. Inserts a new auth_users record with role='admin'
 * 3. Creates a SubAdmin record linking user to role
 *
 * @param {object} data - { first_name, last_name, email, phone, password, role_id }
 * @param {string} createdBy - UUID of the admin creating this sub-admin
 * @returns {Promise<object>} The created sub-admin with user info
 */
async function createSubAdmin(data, createdBy) {
  const { first_name, last_name, email, phone, password, role_id } = data;

  // Verify role exists
  const role = await AdminRole.findByPk(role_id);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  // Check if email already exists in auth_users
  const [existingUsers] = await sequelize.query(
    'SELECT id FROM auth_users WHERE email = :email AND deleted_at IS NULL LIMIT 1',
    { replacements: { email }, type: QueryTypes.SELECT }
  ).then((rows) => [rows]);

  if (existingUsers && existingUsers.length > 0) {
    throw new AppError('A user with this email already exists', 409);
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const now = new Date();

  // Start a transaction to ensure atomicity
  const transaction = await sequelize.transaction();

  try {
    // Insert into auth_users with role='admin' and auto-verified
    await sequelize.query(
      `INSERT INTO auth_users (id, email, password, first_name, last_name, phone, role, status, email_verified_at, created_at, updated_at)
       VALUES (:id, :email, :password, :first_name, :last_name, :phone, 'admin', 'active', :now, :now, :now)`,
      {
        replacements: {
          id: userId,
          email,
          password: hashedPassword,
          first_name,
          last_name,
          phone: phone || null,
          now,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    // Create SubAdmin record
    const subAdmin = await SubAdmin.create(
      {
        user_id: userId,
        role_id,
        status: 'active',
        created_by: createdBy,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch the created sub-admin with role info
    const result = await SubAdmin.findByPk(subAdmin.id, {
      include: [{ model: AdminRole, as: 'role' }],
    });

    return {
      ...result.toJSON(),
      user: {
        id: userId,
        email,
        first_name,
        last_name,
        phone: phone || null,
      },
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Lists sub-admins with pagination and optional role include.
 *
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function listSubAdmins(filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  const { count, rows } = await SubAdmin.findAndCountAll({
    include: [{ model: AdminRole, as: 'role' }],
    offset,
    limit: safeLimit,
    order: [['created_at', 'DESC']],
  });

  // Fetch user info for each sub-admin from auth_users
  const userIds = rows.map((sa) => sa.user_id);
  let usersMap = {};

  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',');
    const users = await sequelize.query(
      `SELECT id, email, first_name, last_name, phone, status, last_login_at
       FROM auth_users WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      { replacements: userIds, type: QueryTypes.SELECT }
    );
    usersMap = users.reduce((map, u) => {
      map[u.id] = u;
      return map;
    }, {});
  }

  const data = rows.map((sa) => ({
    ...sa.toJSON(),
    user: usersMap[sa.user_id] || null,
  }));

  const meta = getPaginationMeta(count, page, limit);

  return { data, meta };
}

/**
 * Updates a sub-admin's role and/or status.
 *
 * @param {string} id - SubAdmin ID
 * @param {object} data - { role_id?, status? }
 * @returns {Promise<object>} Updated sub-admin
 */
async function updateSubAdmin(id, data) {
  const subAdmin = await SubAdmin.findByPk(id, {
    include: [{ model: AdminRole, as: 'role' }],
  });

  if (!subAdmin) {
    throw new AppError('Sub-admin not found', 404);
  }

  // Validate role if provided
  if (data.role_id) {
    const role = await AdminRole.findByPk(data.role_id);
    if (!role) {
      throw new AppError('Role not found', 404);
    }
  }

  await subAdmin.update(data);

  // Re-fetch with role
  const updated = await SubAdmin.findByPk(id, {
    include: [{ model: AdminRole, as: 'role' }],
  });

  // Fetch user info
  const [user] = await sequelize.query(
    'SELECT id, email, first_name, last_name, phone, status FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId: updated.user_id }, type: QueryTypes.SELECT }
  );

  return {
    ...updated.toJSON(),
    user: user || null,
  };
}

/**
 * Soft-deletes a sub-admin and deactivates the auth_users record.
 *
 * @param {string} id - SubAdmin ID
 */
async function deleteSubAdmin(id) {
  const subAdmin = await SubAdmin.findByPk(id);

  if (!subAdmin) {
    throw new AppError('Sub-admin not found', 404);
  }

  const transaction = await sequelize.transaction();

  try {
    // Soft-delete the sub-admin record
    await subAdmin.destroy({ transaction });

    // Deactivate the auth_users record
    await sequelize.query(
      'UPDATE auth_users SET status = :status, updated_at = :now WHERE id = :userId',
      {
        replacements: {
          status: 'inactive',
          now: new Date(),
          userId: subAdmin.user_id,
        },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ===========================================================================
// USER MANAGEMENT
// ===========================================================================

/**
 * Lists platform users with pagination, search, and filters.
 *
 * @param {object} filters - { page, limit, search, status, plan, date_from, date_to }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function listUsers(filters) {
  const { page = 1, limit = 20, search, status, date_from, date_to } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  let whereClauses = ["u.role = 'user'", 'u.deleted_at IS NULL'];
  const replacements = {};

  if (search) {
    whereClauses.push(
      "(u.first_name LIKE :search OR u.last_name LIKE :search OR u.email LIKE :search OR u.phone LIKE :search)"
    );
    replacements.search = `%${search}%`;
  }

  if (status) {
    whereClauses.push('u.status = :status');
    replacements.status = status;
  }

  if (date_from) {
    whereClauses.push('u.created_at >= :date_from');
    replacements.date_from = date_from;
  }

  if (date_to) {
    whereClauses.push('u.created_at <= :date_to');
    replacements.date_to = date_to;
  }

  const whereSQL = whereClauses.join(' AND ');

  // Count total
  const [countResult] = await sequelize.query(
    `SELECT COUNT(*) AS total FROM auth_users u WHERE ${whereSQL}`,
    { replacements, type: QueryTypes.SELECT }
  );
  const total = parseInt(countResult.total, 10);

  // Fetch users
  const users = await sequelize.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status,
            u.email_verified_at, u.last_login_at, u.login_count, u.created_at, u.updated_at
     FROM auth_users u
     WHERE ${whereSQL}
     ORDER BY u.created_at DESC
     LIMIT :limit OFFSET :offset`,
    {
      replacements: { ...replacements, limit: safeLimit, offset },
      type: QueryTypes.SELECT,
    }
  );

  const meta = getPaginationMeta(total, page, limit);

  return { data: users, meta };
}

/**
 * Gets a single user by ID with extended details.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<object>} User data with wallet and subscription info
 */
async function getUser(userId) {
  const [user] = await sequelize.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.role,
            u.status, u.email_verified_at, u.last_login_at, u.last_login_ip,
            u.login_count, u.created_at, u.updated_at
     FROM auth_users u
     WHERE u.id = :userId AND u.deleted_at IS NULL`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Attempt to fetch wallet balance (fail gracefully if table doesn't exist yet)
  let wallet = null;
  try {
    const [walletRow] = await sequelize.query(
      'SELECT id, balance, currency FROM wallet_wallets WHERE user_id = :userId LIMIT 1',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    wallet = walletRow || null;
  } catch (_err) {
    // wallet table may not exist yet
  }

  // Attempt to fetch active subscription (fail gracefully if table doesn't exist yet)
  let subscription = null;
  try {
    const [subRow] = await sequelize.query(
      `SELECT s.id, s.plan_id, s.status, s.starts_at, s.expires_at,
              p.name AS plan_name, p.type AS plan_type
       FROM sub_subscriptions s
       LEFT JOIN sub_plans p ON p.id = s.plan_id
       WHERE s.user_id = :userId AND s.status = 'active' AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC LIMIT 1`,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    subscription = subRow || null;
  } catch (_err) {
    // subscription tables may not exist yet
  }

  return {
    ...user,
    wallet,
    subscription,
  };
}

/**
 * Creates a new platform user (admin-initiated, auto-verified).
 *
 * @param {object} data - { first_name, last_name, email, phone, password }
 * @returns {Promise<object>} Created user
 */
async function createUser(data) {
  const { first_name, last_name, email, phone, password } = data;

  // Check for existing email
  const [existing] = await sequelize.query(
    'SELECT id FROM auth_users WHERE email = :email AND deleted_at IS NULL LIMIT 1',
    { replacements: { email }, type: QueryTypes.SELECT }
  );

  if (existing) {
    throw new AppError('A user with this email already exists', 409);
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = uuidv4();
  const now = new Date();

  await sequelize.query(
    `INSERT INTO auth_users (id, email, password, first_name, last_name, phone, role, status, email_verified_at, created_at, updated_at)
     VALUES (:id, :email, :password, :first_name, :last_name, :phone, 'user', 'active', :now, :now, :now)`,
    {
      replacements: {
        id: userId,
        email,
        password: hashedPassword,
        first_name,
        last_name,
        phone: phone || null,
        now,
      },
      type: QueryTypes.INSERT,
    }
  );

  return {
    id: userId,
    email,
    first_name,
    last_name,
    phone: phone || null,
    role: 'user',
    status: 'active',
    email_verified_at: now,
    created_at: now,
  };
}

/**
 * Updates a user's status (active, inactive, suspended).
 *
 * @param {string} userId - User UUID
 * @param {string} status - New status value
 * @returns {Promise<object>} Updated user
 */
async function updateUserStatus(userId, status) {
  const [user] = await sequelize.query(
    'SELECT id, role FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'super_admin') {
    throw new AppError('Cannot change super admin status', 403);
  }

  const now = new Date();
  await sequelize.query(
    'UPDATE auth_users SET status = :status, updated_at = :now WHERE id = :userId',
    {
      replacements: { status, now, userId },
      type: QueryTypes.UPDATE,
    }
  );

  return { id: userId, status, updated_at: now };
}

/**
 * Soft-deletes a user after verifying they have no active resources.
 *
 * @param {string} userId - User UUID
 */
async function deleteUser(userId) {
  const [user] = await sequelize.query(
    'SELECT id, role FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'super_admin' || user.role === 'admin') {
    throw new AppError('Cannot delete admin users through this endpoint', 403);
  }

  // Check for active subscriptions (fail gracefully)
  try {
    const [activeSub] = await sequelize.query(
      "SELECT id FROM sub_subscriptions WHERE user_id = :userId AND status = 'active' AND deleted_at IS NULL LIMIT 1",
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    if (activeSub) {
      throw new AppError('Cannot delete user with an active subscription. Cancel it first.', 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // table may not exist
  }

  // Check for wallet balance > 0 (fail gracefully)
  try {
    const [wallet] = await sequelize.query(
      'SELECT balance FROM wallet_wallets WHERE user_id = :userId LIMIT 1',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    if (wallet && wallet.balance > 0) {
      throw new AppError('Cannot delete user with non-zero wallet balance. Debit it first.', 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // table may not exist
  }

  const now = new Date();
  await sequelize.query(
    'UPDATE auth_users SET status = :status, deleted_at = :now, updated_at = :now WHERE id = :userId',
    {
      replacements: { status: 'inactive', now, userId },
      type: QueryTypes.UPDATE,
    }
  );
}

/**
 * Credits a user's wallet via the wallet-service API.
 *
 * @param {string} userId - User UUID
 * @param {number} amount - Amount in paise
 * @param {string} remarks - Description for the transaction
 * @param {string} adminUserId - Admin performing the action
 * @returns {Promise<object>} Transaction result from wallet-service
 */
async function creditWallet(userId, amount, remarks, adminUserId) {
  // Verify user exists
  const [user] = await sequelize.query(
    'SELECT id FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  if (!user) {
    throw new AppError('User not found', 404);
  }

  try {
    const response = await axios.post(
      `${config.walletServiceUrl}/api/v1/wallet/admin/credit`,
      {
        user_id: userId,
        amount,
        remarks,
        admin_user_id: adminUserId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': adminUserId,
          'x-user-role': 'super_admin',
        },
        timeout: 10000,
      }
    );

    return response.data.data || response.data;
  } catch (err) {
    if (err.response) {
      throw new AppError(
        err.response.data.message || 'Failed to credit wallet',
        err.response.status
      );
    }
    throw new AppError('Wallet service is unavailable', 503);
  }
}

/**
 * Debits a user's wallet via the wallet-service API.
 *
 * @param {string} userId - User UUID
 * @param {number} amount - Amount in paise
 * @param {string} remarks - Description for the transaction
 * @param {string} adminUserId - Admin performing the action
 * @returns {Promise<object>} Transaction result from wallet-service
 */
async function debitWallet(userId, amount, remarks, adminUserId) {
  // Verify user exists
  const [user] = await sequelize.query(
    'SELECT id FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  if (!user) {
    throw new AppError('User not found', 404);
  }

  try {
    const response = await axios.post(
      `${config.walletServiceUrl}/api/v1/wallet/admin/debit`,
      {
        user_id: userId,
        amount,
        remarks,
        admin_user_id: adminUserId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': adminUserId,
          'x-user-role': 'super_admin',
        },
        timeout: 10000,
      }
    );

    return response.data.data || response.data;
  } catch (err) {
    if (err.response) {
      throw new AppError(
        err.response.data.message || 'Failed to debit wallet',
        err.response.status
      );
    }
    throw new AppError('Wallet service is unavailable', 503);
  }
}

/**
 * Gets a user's wallet transactions with pagination.
 *
 * @param {string} userId - User UUID
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function getUserTransactions(userId, filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  // Verify user exists
  const [user] = await sequelize.query(
    'SELECT id FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  if (!user) {
    throw new AppError('User not found', 404);
  }

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM wallet_transactions WHERE user_id = :userId',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const transactions = await sequelize.query(
      `SELECT id, type, amount, balance_after, description, reference_id, reference_type, created_at
       FROM wallet_transactions
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { userId, limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const meta = getPaginationMeta(total, page, limit);
    return { data: transactions, meta };
  } catch (_err) {
    // wallet_transactions table may not exist yet
    return { data: [], meta: getPaginationMeta(0, page, limit) };
  }
}

/**
 * Gets a user's subscription history with pagination.
 *
 * @param {string} userId - User UUID
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function getUserSubscriptions(userId, filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  // Verify user exists
  const [user] = await sequelize.query(
    'SELECT id FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  if (!user) {
    throw new AppError('User not found', 404);
  }

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM sub_subscriptions WHERE user_id = :userId AND deleted_at IS NULL',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const subscriptions = await sequelize.query(
      `SELECT s.id, s.plan_id, s.status, s.starts_at, s.expires_at, s.created_at,
              p.name AS plan_name, p.type AS plan_type, p.price AS plan_price
       FROM sub_subscriptions s
       LEFT JOIN sub_plans p ON p.id = s.plan_id
       WHERE s.user_id = :userId AND s.deleted_at IS NULL
       ORDER BY s.created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { userId, limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const meta = getPaginationMeta(total, page, limit);
    return { data: subscriptions, meta };
  } catch (_err) {
    return { data: [], meta: getPaginationMeta(0, page, limit) };
  }
}

/**
 * Gets a user's invoices with pagination.
 *
 * @param {string} userId - User UUID
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function getUserInvoices(userId, filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  // Verify user exists
  const [user] = await sequelize.query(
    'SELECT id FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  if (!user) {
    throw new AppError('User not found', 404);
  }

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM wallet_invoices WHERE user_id = :userId',
      { replacements: { userId }, type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const invoices = await sequelize.query(
      `SELECT id, invoice_number, amount, tax_amount, total_amount, status,
              payment_method, paid_at, created_at
       FROM wallet_invoices
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { userId, limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const meta = getPaginationMeta(total, page, limit);
    return { data: invoices, meta };
  } catch (_err) {
    return { data: [], meta: getPaginationMeta(0, page, limit) };
  }
}

// ===========================================================================
// PLANS MANAGEMENT
// ===========================================================================

/**
 * Creates a new subscription plan.
 *
 * @param {object} data - Plan fields
 * @returns {Promise<object>} Created plan
 */
async function createPlan(data) {
  const id = uuidv4();
  const now = new Date();

  const columns = [
    'id', 'name', 'description', 'type', 'price', 'currency',
    'max_contacts', 'max_templates', 'max_campaigns_per_month', 'max_messages_per_month',
    'max_team_members', 'max_organizations', 'max_whatsapp_numbers',
    'has_priority_support', 'marketing_message_price', 'utility_message_price',
    'auth_message_price', 'features', 'sort_order', 'is_active',
    'created_at', 'updated_at',
  ];

  const values = {
    id,
    name: data.name,
    description: data.description || null,
    type: data.type,
    price: data.price,
    currency: data.currency || 'INR',
    max_contacts: data.max_contacts || 0,
    max_templates: data.max_templates || 0,
    max_campaigns_per_month: data.max_campaigns_per_month || 0,
    max_messages_per_month: data.max_messages_per_month || 0,
    max_team_members: data.max_team_members || 0,
    max_organizations: data.max_organizations || 1,
    max_whatsapp_numbers: data.max_whatsapp_numbers || 1,
    has_priority_support: data.has_priority_support || false,
    marketing_message_price: data.marketing_message_price || 0,
    utility_message_price: data.utility_message_price || 0,
    auth_message_price: data.auth_message_price || 0,
    features: data.features ? JSON.stringify(data.features) : null,
    sort_order: data.sort_order || 0,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  const placeholders = columns.map((col) => `:${col}`).join(', ');
  const columnNames = columns.join(', ');

  await sequelize.query(
    `INSERT INTO sub_plans (${columnNames}) VALUES (${placeholders})`,
    { replacements: values, type: QueryTypes.INSERT }
  );

  return { id, ...data, is_active: true, created_at: now, updated_at: now };
}

/**
 * Lists all subscription plans with pagination.
 *
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function listPlans(filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM sub_plans WHERE deleted_at IS NULL',
      { type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const plans = await sequelize.query(
      `SELECT id, name, description, type, price, currency,
              max_contacts, max_templates, max_campaigns_per_month, max_messages_per_month,
              max_team_members, max_organizations, max_whatsapp_numbers,
              has_priority_support, marketing_message_price, utility_message_price,
              auth_message_price, features, sort_order, is_active, created_at, updated_at
       FROM sub_plans
       WHERE deleted_at IS NULL
       ORDER BY sort_order ASC, created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    // Parse features JSON if it's a string
    const parsedPlans = plans.map((p) => ({
      ...p,
      features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features,
    }));

    const meta = getPaginationMeta(total, page, limit);
    return { data: parsedPlans, meta };
  } catch (err) {
    if (err.original && err.original.code === 'ER_NO_SUCH_TABLE') {
      return { data: [], meta: getPaginationMeta(0, page, limit) };
    }
    throw err;
  }
}

/**
 * Gets a single plan by ID.
 *
 * @param {string} planId - Plan UUID
 * @returns {Promise<object>} Plan data
 */
async function getPlan(planId) {
  const [plan] = await sequelize.query(
    `SELECT id, name, description, type, price, currency,
            max_contacts, max_templates, max_campaigns_per_month, max_messages_per_month,
            max_team_members, max_organizations, max_whatsapp_numbers,
            has_priority_support, marketing_message_price, utility_message_price,
            auth_message_price, features, sort_order, is_active, created_at, updated_at
     FROM sub_plans
     WHERE id = :planId AND deleted_at IS NULL`,
    { replacements: { planId }, type: QueryTypes.SELECT }
  );

  if (!plan) {
    throw new AppError('Plan not found', 404);
  }

  plan.features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;

  return plan;
}

/**
 * Updates a subscription plan.
 *
 * @param {string} planId - Plan UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>} Updated plan
 */
async function updatePlan(planId, data) {
  // Verify plan exists
  const [existing] = await sequelize.query(
    'SELECT id FROM sub_plans WHERE id = :planId AND deleted_at IS NULL',
    { replacements: { planId }, type: QueryTypes.SELECT }
  );

  if (!existing) {
    throw new AppError('Plan not found', 404);
  }

  const updateFields = [];
  const replacements = { planId, now: new Date() };

  const allowedFields = [
    'name', 'description', 'type', 'price', 'currency',
    'max_contacts', 'max_templates', 'max_campaigns_per_month', 'max_messages_per_month',
    'max_team_members', 'max_organizations', 'max_whatsapp_numbers',
    'has_priority_support', 'marketing_message_price', 'utility_message_price',
    'auth_message_price', 'sort_order',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateFields.push(`${field} = :${field}`);
      replacements[field] = data[field];
    }
  }

  // Handle features JSON separately
  if (data.features !== undefined) {
    updateFields.push('features = :features');
    replacements.features = JSON.stringify(data.features);
  }

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  updateFields.push('updated_at = :now');

  await sequelize.query(
    `UPDATE sub_plans SET ${updateFields.join(', ')} WHERE id = :planId`,
    { replacements, type: QueryTypes.UPDATE }
  );

  return getPlan(planId);
}

/**
 * Soft-deletes a subscription plan.
 *
 * @param {string} planId - Plan UUID
 */
async function deletePlan(planId) {
  const [existing] = await sequelize.query(
    'SELECT id FROM sub_plans WHERE id = :planId AND deleted_at IS NULL',
    { replacements: { planId }, type: QueryTypes.SELECT }
  );

  if (!existing) {
    throw new AppError('Plan not found', 404);
  }

  // Check if plan has active subscriptions
  try {
    const [activeSub] = await sequelize.query(
      "SELECT id FROM sub_subscriptions WHERE plan_id = :planId AND status = 'active' AND deleted_at IS NULL LIMIT 1",
      { replacements: { planId }, type: QueryTypes.SELECT }
    );
    if (activeSub) {
      throw new AppError('Cannot delete a plan with active subscriptions', 400);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // table may not exist
  }

  const now = new Date();
  await sequelize.query(
    'UPDATE sub_plans SET deleted_at = :now, updated_at = :now WHERE id = :planId',
    { replacements: { now, planId }, type: QueryTypes.UPDATE }
  );
}

/**
 * Updates the active/inactive status of a plan.
 *
 * @param {string} planId - Plan UUID
 * @param {boolean} isActive - New active status
 * @returns {Promise<object>} Updated plan
 */
async function updatePlanStatus(planId, isActive) {
  const [existing] = await sequelize.query(
    'SELECT id FROM sub_plans WHERE id = :planId AND deleted_at IS NULL',
    { replacements: { planId }, type: QueryTypes.SELECT }
  );

  if (!existing) {
    throw new AppError('Plan not found', 404);
  }

  const now = new Date();
  await sequelize.query(
    'UPDATE sub_plans SET is_active = :isActive, updated_at = :now WHERE id = :planId',
    { replacements: { isActive, now, planId }, type: QueryTypes.UPDATE }
  );

  return getPlan(planId);
}

// ===========================================================================
// COUPONS MANAGEMENT
// ===========================================================================

/**
 * Creates a new coupon.
 *
 * @param {object} data - Coupon fields
 * @returns {Promise<object>} Created coupon
 */
async function createCoupon(data) {
  const id = uuidv4();
  const now = new Date();

  // Check for duplicate code
  try {
    const [existing] = await sequelize.query(
      'SELECT id FROM sub_coupons WHERE code = :code AND deleted_at IS NULL LIMIT 1',
      { replacements: { code: data.code }, type: QueryTypes.SELECT }
    );
    if (existing) {
      throw new AppError('A coupon with this code already exists', 409);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // table may not exist yet - proceed with insert
  }

  const values = {
    id,
    code: data.code,
    description: data.description || null,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    max_uses: data.max_uses || null,
    used_count: 0,
    min_plan_price: data.min_plan_price || null,
    applicable_plan_ids: data.applicable_plan_ids ? JSON.stringify(data.applicable_plan_ids) : null,
    applicable_user_ids: data.applicable_user_ids ? JSON.stringify(data.applicable_user_ids) : null,
    valid_from: data.valid_from,
    valid_until: data.valid_until || null,
    is_active: data.is_active !== undefined ? data.is_active : true,
    created_at: now,
    updated_at: now,
  };

  const columns = Object.keys(values);
  const placeholders = columns.map((col) => `:${col}`).join(', ');
  const columnNames = columns.join(', ');

  await sequelize.query(
    `INSERT INTO sub_coupons (${columnNames}) VALUES (${placeholders})`,
    { replacements: values, type: QueryTypes.INSERT }
  );

  return { id, ...data, used_count: 0, created_at: now, updated_at: now };
}

/**
 * Lists coupons with pagination.
 *
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function listCoupons(filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  try {
    const [countResult] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM sub_coupons WHERE deleted_at IS NULL',
      { type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const coupons = await sequelize.query(
      `SELECT id, code, description, discount_type, discount_value, max_uses, used_count,
              min_plan_price, applicable_plan_ids, applicable_user_ids,
              valid_from, valid_until, is_active, created_at, updated_at
       FROM sub_coupons
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    // Parse JSON fields
    const parsedCoupons = coupons.map((c) => ({
      ...c,
      applicable_plan_ids:
        typeof c.applicable_plan_ids === 'string'
          ? JSON.parse(c.applicable_plan_ids)
          : c.applicable_plan_ids,
      applicable_user_ids:
        typeof c.applicable_user_ids === 'string'
          ? JSON.parse(c.applicable_user_ids)
          : c.applicable_user_ids,
    }));

    const meta = getPaginationMeta(total, page, limit);
    return { data: parsedCoupons, meta };
  } catch (err) {
    if (err.original && err.original.code === 'ER_NO_SUCH_TABLE') {
      return { data: [], meta: getPaginationMeta(0, page, limit) };
    }
    throw err;
  }
}

/**
 * Gets a single coupon by ID.
 *
 * @param {string} couponId - Coupon UUID
 * @returns {Promise<object>} Coupon data
 */
async function getCoupon(couponId) {
  const [coupon] = await sequelize.query(
    `SELECT id, code, description, discount_type, discount_value, max_uses, used_count,
            min_plan_price, applicable_plan_ids, applicable_user_ids,
            valid_from, valid_until, is_active, created_at, updated_at
     FROM sub_coupons
     WHERE id = :couponId AND deleted_at IS NULL`,
    { replacements: { couponId }, type: QueryTypes.SELECT }
  );

  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }

  coupon.applicable_plan_ids =
    typeof coupon.applicable_plan_ids === 'string'
      ? JSON.parse(coupon.applicable_plan_ids)
      : coupon.applicable_plan_ids;
  coupon.applicable_user_ids =
    typeof coupon.applicable_user_ids === 'string'
      ? JSON.parse(coupon.applicable_user_ids)
      : coupon.applicable_user_ids;

  return coupon;
}

/**
 * Updates a coupon.
 *
 * @param {string} couponId - Coupon UUID
 * @param {object} data - Fields to update
 * @returns {Promise<object>} Updated coupon
 */
async function updateCoupon(couponId, data) {
  // Verify coupon exists
  const [existing] = await sequelize.query(
    'SELECT id FROM sub_coupons WHERE id = :couponId AND deleted_at IS NULL',
    { replacements: { couponId }, type: QueryTypes.SELECT }
  );

  if (!existing) {
    throw new AppError('Coupon not found', 404);
  }

  const updateFields = [];
  const replacements = { couponId, now: new Date() };

  const simpleFields = [
    'code', 'description', 'discount_type', 'discount_value',
    'max_uses', 'min_plan_price', 'valid_from', 'valid_until', 'is_active',
  ];

  for (const field of simpleFields) {
    if (data[field] !== undefined) {
      updateFields.push(`${field} = :${field}`);
      replacements[field] = data[field];
    }
  }

  // Handle JSON fields
  if (data.applicable_plan_ids !== undefined) {
    updateFields.push('applicable_plan_ids = :applicable_plan_ids');
    replacements.applicable_plan_ids = JSON.stringify(data.applicable_plan_ids);
  }
  if (data.applicable_user_ids !== undefined) {
    updateFields.push('applicable_user_ids = :applicable_user_ids');
    replacements.applicable_user_ids = JSON.stringify(data.applicable_user_ids);
  }

  if (updateFields.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  updateFields.push('updated_at = :now');

  await sequelize.query(
    `UPDATE sub_coupons SET ${updateFields.join(', ')} WHERE id = :couponId`,
    { replacements, type: QueryTypes.UPDATE }
  );

  return getCoupon(couponId);
}

/**
 * Soft-deletes a coupon.
 *
 * @param {string} couponId - Coupon UUID
 */
async function deleteCoupon(couponId) {
  const [existing] = await sequelize.query(
    'SELECT id FROM sub_coupons WHERE id = :couponId AND deleted_at IS NULL',
    { replacements: { couponId }, type: QueryTypes.SELECT }
  );

  if (!existing) {
    throw new AppError('Coupon not found', 404);
  }

  const now = new Date();
  await sequelize.query(
    'UPDATE sub_coupons SET deleted_at = :now, updated_at = :now WHERE id = :couponId',
    { replacements: { now, couponId }, type: QueryTypes.UPDATE }
  );
}

// ===========================================================================
// NOTIFICATIONS / BROADCASTS
// ===========================================================================

/**
 * Creates a broadcast notification to all users or specific users.
 * Publishes to Kafka NOTIFICATION_SEND topic.
 *
 * @param {object} data - { title, body, target_type, target_user_ids, send_email }
 * @param {string} adminUserId - Admin creating the broadcast
 * @param {import('kafkajs').Producer|null} kafkaProducer - Kafka producer instance
 * @returns {Promise<object>} Broadcast details
 */
async function createBroadcast(data, adminUserId, kafkaProducer) {
  const { title, body, target_type, target_user_ids, send_email } = data;

  let userIds = [];

  if (target_type === 'all') {
    // Fetch all active user IDs
    const users = await sequelize.query(
      "SELECT id FROM auth_users WHERE role = 'user' AND status = 'active' AND deleted_at IS NULL",
      { type: QueryTypes.SELECT }
    );
    userIds = users.map((u) => u.id);
  } else if (target_type === 'specific_users' && target_user_ids && target_user_ids.length > 0) {
    userIds = target_user_ids;
  } else {
    throw new AppError('For specific_users target type, target_user_ids are required', 400);
  }

  if (userIds.length === 0) {
    throw new AppError('No target users found for this broadcast', 400);
  }

  // Publish notification events to Kafka for each user
  const { TOPICS, publishEvent } = require('@nyife/shared-events');
  let publishedCount = 0;

  if (kafkaProducer) {
    for (const userId of userIds) {
      try {
        await publishEvent(kafkaProducer, TOPICS.NOTIFICATION_SEND, userId, {
          userId,
          type: 'in_app',
          title,
          body,
          data: { broadcast: true, admin_id: adminUserId },
          channel: 'admin_broadcast',
        });
        publishedCount++;

        // Also send email if requested
        if (send_email) {
          // Fetch user email
          const [user] = await sequelize.query(
            'SELECT email FROM auth_users WHERE id = :userId AND deleted_at IS NULL',
            { replacements: { userId }, type: QueryTypes.SELECT }
          );

          if (user) {
            await publishEvent(kafkaProducer, TOPICS.EMAIL_SEND, userId, {
              to: user.email,
              subject: title,
              html: body,
            });
          }
        }
      } catch (err) {
        console.error(`[admin-service] Failed to publish notification for user ${userId}:`, err.message);
      }
    }
  } else {
    console.warn('[admin-service] Kafka producer not available. Notifications not sent.');
  }

  return {
    title,
    body,
    target_type,
    target_count: userIds.length,
    published_count: publishedCount,
    send_email,
    created_by: adminUserId,
    created_at: new Date(),
  };
}

/**
 * Lists past broadcast notifications from the database.
 * Since we don't have a dedicated broadcasts table, this queries
 * notification-service data if available, or returns empty.
 *
 * @param {object} filters - { page, limit }
 * @returns {Promise<{ data: Array, meta: object }>}
 */
async function listBroadcasts(filters) {
  const { page = 1, limit = 20 } = filters;
  const { offset, limit: safeLimit } = getPagination(page, limit);

  try {
    const [countResult] = await sequelize.query(
      "SELECT COUNT(*) AS total FROM notif_notifications WHERE channel = 'admin_broadcast'",
      { type: QueryTypes.SELECT }
    );
    const total = parseInt(countResult.total, 10);

    const broadcasts = await sequelize.query(
      `SELECT id, user_id, title, body, type, is_read, created_at
       FROM notif_notifications
       WHERE channel = 'admin_broadcast'
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements: { limit: safeLimit, offset },
        type: QueryTypes.SELECT,
      }
    );

    const meta = getPaginationMeta(total, page, limit);
    return { data: broadcasts, meta };
  } catch (_err) {
    // Table may not exist yet
    return { data: [], meta: getPaginationMeta(0, page, limit) };
  }
}

// ===========================================================================
// SETTINGS MANAGEMENT
// ===========================================================================

/**
 * Gets all admin settings grouped by group name.
 *
 * @returns {Promise<object>} Settings grouped by group key
 */
async function getAllSettings() {
  const settings = await AdminSetting.findAll({
    order: [['group', 'ASC']],
  });

  const grouped = {};
  for (const setting of settings) {
    grouped[setting.group] = setting.value;
  }

  return grouped;
}

/**
 * Gets settings for a specific group.
 *
 * @param {string} group - The settings group name
 * @returns {Promise<object>} Settings value for the group
 */
async function getSettingsByGroup(group) {
  const setting = await AdminSetting.findOne({ where: { group, key: group } });

  if (!setting) {
    throw new AppError(`Settings group "${group}" not found`, 404);
  }

  return setting.value;
}

/**
 * Updates settings for a specific group (upsert).
 *
 * @param {string} group - The settings group name
 * @param {object} data - New settings values to merge
 * @param {string} updatedBy - Admin user ID performing the update
 * @returns {Promise<object>} Updated settings value
 */
async function updateSettings(group, data, updatedBy) {
  let setting = await AdminSetting.findOne({ where: { group, key: group } });

  if (setting) {
    // Merge new data into existing value
    const currentValue = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
    const mergedValue = { ...currentValue, ...data };
    await setting.update({ value: mergedValue, updated_by: updatedBy });
    return mergedValue;
  } else {
    // Create new setting
    setting = await AdminSetting.create({
      key: group,
      group,
      value: data,
      updated_by: updatedBy,
    });
    return setting.value;
  }
}

/**
 * Gets public (non-sensitive) settings for the frontend.
 * Returns: general info, SSO enabled status (not secrets), languages, frontend HTML.
 *
 * @returns {Promise<object>} Public settings
 */
async function getPublicSettings() {
  const settings = await AdminSetting.findAll();
  const settingsMap = {};

  for (const s of settings) {
    settingsMap[s.group] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
  }

  // Build public-safe response (strip secrets)
  const result = {};

  // General info (all public)
  if (settingsMap.general) {
    result.general = settingsMap.general;
  }

  // SEO (all public)
  if (settingsMap.seo) {
    result.seo = settingsMap.seo;
  }

  // Timezone/currency (public)
  if (settingsMap.timezone) {
    result.timezone = settingsMap.timezone;
  }

  // SSO: only show enabled status, not client secrets
  if (settingsMap.sso) {
    result.sso = {
      google: { enabled: settingsMap.sso.google ? settingsMap.sso.google.enabled : false },
      facebook: { enabled: settingsMap.sso.facebook ? settingsMap.sso.facebook.enabled : false },
    };
  }

  // Languages (public)
  if (settingsMap.languages) {
    result.languages = settingsMap.languages;
  }

  // Frontend pages HTML (public)
  if (settingsMap.frontend) {
    result.frontend = settingsMap.frontend;
  }

  // Tax: only show if enabled and the rate/type
  if (settingsMap.tax) {
    result.tax = {
      enabled: settingsMap.tax.enabled || false,
      type: settingsMap.tax.type || 'GST',
      rate: settingsMap.tax.rate || 0,
      inclusive: settingsMap.tax.inclusive || false,
    };
  }

  return result;
}

// ===========================================================================
// ROLES MANAGEMENT
// ===========================================================================

/**
 * Creates a new admin role.
 *
 * @param {object} data - { title, permissions }
 * @returns {Promise<object>} Created role
 */
async function createRole(data) {
  const role = await AdminRole.create({
    title: data.title,
    permissions: data.permissions,
    is_system: false,
  });

  return role;
}

/**
 * Lists all admin roles.
 *
 * @returns {Promise<Array>} List of roles
 */
async function listRoles() {
  const roles = await AdminRole.findAll({
    order: [
      ['is_system', 'DESC'],
      ['title', 'ASC'],
    ],
  });

  return roles;
}

/**
 * Updates an admin role. System roles can only have their title updated.
 *
 * @param {string} roleId - Role UUID
 * @param {object} data - { title?, permissions? }
 * @returns {Promise<object>} Updated role
 */
async function updateRole(roleId, data) {
  const role = await AdminRole.findByPk(roleId);

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  // System roles cannot have their permissions changed
  if (role.is_system && data.permissions) {
    throw new AppError('Cannot modify permissions of a system role', 403);
  }

  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.permissions !== undefined && !role.is_system) updateData.permissions = data.permissions;

  await role.update(updateData);

  return role;
}

/**
 * Deletes an admin role.
 * Cannot delete system roles or roles with active sub-admins.
 *
 * @param {string} roleId - Role UUID
 */
async function deleteRole(roleId) {
  const role = await AdminRole.findByPk(roleId);

  if (!role) {
    throw new AppError('Role not found', 404);
  }

  if (role.is_system) {
    throw new AppError('Cannot delete a system role', 403);
  }

  // Check if any sub-admins are using this role
  const subAdminCount = await SubAdmin.count({ where: { role_id: roleId } });
  if (subAdminCount > 0) {
    throw new AppError(
      `Cannot delete role: ${subAdminCount} sub-admin(s) are assigned to this role`,
      400
    );
  }

  await role.destroy();
}

module.exports = {
  // Sub-admin
  createSubAdmin,
  listSubAdmins,
  updateSubAdmin,
  deleteSubAdmin,

  // Users
  listUsers,
  getUser,
  createUser,
  updateUserStatus,
  deleteUser,
  creditWallet,
  debitWallet,
  getUserTransactions,
  getUserSubscriptions,
  getUserInvoices,

  // Plans
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deletePlan,
  updatePlanStatus,

  // Coupons
  createCoupon,
  listCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,

  // Notifications
  createBroadcast,
  listBroadcasts,

  // Settings
  getAllSettings,
  getSettingsByGroup,
  updateSettings,
  getPublicSettings,

  // Roles
  createRole,
  listRoles,
  updateRole,
  deleteRole,
};
