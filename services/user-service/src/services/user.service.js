'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op, QueryTypes } = require('sequelize');
const {
  AppError,
  assertAuthUserPhoneAvailable,
  generateUUID,
  generateApiToken,
  getPagination,
  getPaginationMeta,
  normalizeOptionalPhone,
} = require('@nyife/shared-utils');
const { sequelize, UserSettings, UserApiToken } = require('../models');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Profile operations
// ---------------------------------------------------------------------------

/**
 * Gets the user profile from the auth_users table via a direct DB query.
 * This service shares the same database instance as auth-service.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @returns {Promise<object>} The user profile data
 * @throws {AppError} 404 if user not found
 */
const getProfile = async (userId) => {
  const [user] = await sequelize.query(
    `SELECT id, email, first_name, last_name, phone, role, status, must_change_password, email_verified_at, avatar_url, created_at, updated_at
     FROM auth_users
     WHERE id = :userId AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  if (!user) {
    throw AppError.notFound('User not found');
  }

  return user;
};

/**
 * Updates profile fields on the auth_users table.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @param {object} data - The fields to update (first_name, last_name, phone)
 * @returns {Promise<object>} The updated user profile
 * @throws {AppError} 404 if user not found
 */
const updateProfile = async (userId, data) => {
  // Build SET clause dynamically based on provided fields
  const allowedFields = ['first_name', 'last_name', 'phone'];
  const setClauses = [];
  const replacements = { userId };

  if (data.phone !== undefined) {
    replacements.phone = await assertAuthUserPhoneAvailable(
      sequelize,
      normalizeOptionalPhone(data.phone),
      {
        excludeUserId: userId,
      }
    );
  }

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = :${field}`);
      if (field !== 'phone') {
        replacements[field] = data[field];
      }
    }
  }

  if (setClauses.length === 0) {
    throw AppError.badRequest('No valid fields provided for update');
  }

  // Always update the updated_at timestamp
  setClauses.push('updated_at = NOW()');

  const [affectedRows] = await sequelize.query(
    `UPDATE auth_users SET ${setClauses.join(', ')} WHERE id = :userId AND deleted_at IS NULL`,
    {
      replacements,
      type: QueryTypes.UPDATE,
    }
  );

  // Fetch and return the updated profile
  const updatedProfile = await getProfile(userId);
  return updatedProfile;
};

/**
 * Changes the user's password after verifying the current password.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @param {string} currentPassword - The user's current password (plain text)
 * @param {string} newPassword - The desired new password (plain text)
 * @returns {Promise<void>}
 * @throws {AppError} 404 if user not found
 * @throws {AppError} 401 if current password is incorrect
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  // Fetch the user's current password hash
  const [user] = await sequelize.query(
    `SELECT id, password FROM auth_users WHERE id = :userId AND deleted_at IS NULL LIMIT 1`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  if (!user) {
    throw AppError.notFound('User not found');
  }

  // Verify the current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw AppError.unauthorized('Current password is incorrect');
  }

  // Hash the new password
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update the password
  await sequelize.query(
    `UPDATE auth_users SET password = :newPasswordHash, updated_at = NOW() WHERE id = :userId`,
    {
      replacements: { userId, newPasswordHash },
      type: QueryTypes.UPDATE,
    }
  );
};

/**
 * Forces a password change for accounts that were created by an organization owner.
 *
 * @param {string} userId
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
const forceChangePassword = async (userId, newPassword) => {
  const [user] = await sequelize.query(
    `SELECT id, must_change_password
     FROM auth_users
     WHERE id = :userId AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
    }
  );

  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (!user.must_change_password) {
    throw AppError.badRequest('Your password does not need to be changed right now.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await sequelize.query(
    `UPDATE auth_users
     SET password = :newPasswordHash,
         must_change_password = false,
         updated_at = NOW()
     WHERE id = :userId`,
    {
      replacements: { userId, newPasswordHash },
      type: QueryTypes.UPDATE,
    }
  );
};

// ---------------------------------------------------------------------------
// Settings operations
// ---------------------------------------------------------------------------

/**
 * Gets the user's settings. If none exist yet, creates a default row.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @returns {Promise<object>} The user settings record
 */
const getSettings = async (userId) => {
  let settings = await UserSettings.findOne({
    where: { user_id: userId },
  });

  if (!settings) {
    // Create default settings on first access
    settings = await UserSettings.create({
      id: generateUUID(),
      user_id: userId,
    });
  }

  return settings;
};

/**
 * Updates the user's settings (partial update — only provided fields are changed).
 *
 * @param {string} userId - The UUID of the authenticated user
 * @param {object} data - Fields to update
 * @returns {Promise<object>} The updated settings record
 */
const updateSettings = async (userId, data) => {
  // Ensure settings exist (get-or-create)
  let settings = await getSettings(userId);

  // Update only the fields that were provided
  const updateableFields = [
    'language',
    'timezone',
    'theme',
    'notification_email',
    'notification_push',
    'notification_in_app',
  ];

  const updateData = {};
  for (const field of updateableFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return settings;
  }

  await settings.update(updateData);

  return settings;
};

// ---------------------------------------------------------------------------
// API Token operations
// ---------------------------------------------------------------------------

/**
 * Creates a new API token for the user.
 * The raw token is generated, hashed with SHA-256, and only the hash is stored.
 * The first 8 characters are stored as a prefix for identification.
 * The full raw token is returned ONLY from this function — it cannot be retrieved later.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @param {string} name - A human-readable name for the token
 * @param {object|null} permissions - Optional permissions object for the token
 * @param {string|null} expiresAt - Optional expiration date as ISO 8601 string
 * @returns {Promise<{ token: string, tokenRecord: object }>} The raw token and the saved record
 */
const createApiToken = async (userId, name, permissions = null, expiresAt = null) => {
  // Generate a cryptographically secure random token
  const rawToken = generateApiToken();

  // Hash the token with SHA-256 for storage
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Store the first 8 characters as an identifiable prefix
  const tokenPrefix = rawToken.substring(0, 8);

  const tokenRecord = await UserApiToken.create({
    id: generateUUID(),
    user_id: userId,
    name,
    token_hash: tokenHash,
    token_prefix: tokenPrefix,
    permissions: permissions || null,
    expires_at: expiresAt || null,
  });

  return {
    token: rawToken,
    tokenRecord,
  };
};

/**
 * Lists API tokens for the user with pagination.
 * Returns token metadata only (prefix, name, dates), never the full hash.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Records per page
 * @returns {Promise<{ tokens: object[], meta: object }>}
 */
const listApiTokens = async (userId, filtersOrPage, maybeLimit) => {
  const filters =
    typeof filtersOrPage === 'object' && filtersOrPage !== null
      ? filtersOrPage
      : { page: filtersOrPage, limit: maybeLimit };
  const { page = 1, limit = 20, search, status, date_from, date_to } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);
  const where = { user_id: userId };

  if (status) {
    where.is_active = status === 'active';
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { token_prefix: { [Op.like]: `%${search}%` } },
    ];
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      const endDate = new Date(date_to);
      endDate.setDate(endDate.getDate() + 1);
      where.created_at[Op.lt] = endDate;
    }
  }

  const { count, rows } = await UserApiToken.findAndCountAll({
    where,
    attributes: [
      'id',
      'name',
      'token_prefix',
      'last_used_at',
      'expires_at',
      'is_active',
      'permissions',
      'created_at',
      'updated_at',
    ],
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return {
    tokens: rows,
    meta,
  };
};

/**
 * Revokes (deactivates) an API token by setting is_active = false.
 *
 * @param {string} userId - The UUID of the authenticated user
 * @param {string} tokenId - The UUID of the token to revoke
 * @returns {Promise<object>} The updated token record
 * @throws {AppError} 404 if token not found or doesn't belong to the user
 */
const revokeApiToken = async (userId, tokenId) => {
  const token = await UserApiToken.findOne({
    where: {
      id: tokenId,
      user_id: userId,
    },
  });

  if (!token) {
    throw AppError.notFound('API token not found');
  }

  if (!token.is_active) {
    throw AppError.badRequest('API token is already revoked');
  }

  await token.update({ is_active: false });

  return token;
};

/**
 * Resolves an opaque API token into the owning active user and token metadata.
 *
 * @param {string} rawToken
 * @returns {Promise<object>}
 */
const resolveApiToken = async (rawToken) => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const tokenRecord = await UserApiToken.findOne({
    where: {
      token_hash: tokenHash,
      is_active: true,
    },
  });

  if (!tokenRecord) {
    throw AppError.unauthorized('Invalid API token', 'API_TOKEN_INVALID');
  }

  if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date()) {
    await tokenRecord.update({ is_active: false });
    throw AppError.unauthorized('API token has expired', 'API_TOKEN_INVALID');
  }

  const [user] = await sequelize.query(
    `SELECT id, email, role, status
     FROM auth_users
     WHERE id = :userId
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { userId: tokenRecord.user_id },
      type: QueryTypes.SELECT,
    }
  );

  if (!user || user.status !== 'active') {
    throw AppError.unauthorized('API token is not usable for this account', 'API_TOKEN_INVALID');
  }

  await tokenRecord.update({ last_used_at: new Date() });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: tokenRecord.permissions || {},
    },
    token: {
      id: tokenRecord.id,
      name: tokenRecord.name,
      permissions: tokenRecord.permissions || {},
      expires_at: tokenRecord.expires_at,
      last_used_at: tokenRecord.last_used_at,
    },
  };
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  forceChangePassword,
  getSettings,
  updateSettings,
  createApiToken,
  listApiTokens,
  revokeApiToken,
  resolveApiToken,
};
