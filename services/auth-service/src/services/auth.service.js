'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, RefreshToken, sequelize } = require('../models');
const { AppError, buildDefaultOrganizationSeed } = require('@nyife/shared-utils');
const config = require('../config');

async function createDefaultOrganizationForUser(user, transaction) {
  const organizationSeed = buildDefaultOrganizationSeed({
    userId: user.id,
    firstName: user.first_name,
  });
  const now = new Date();
  const organizationId = crypto.randomUUID();

  await sequelize.query(
    `INSERT INTO org_organizations (id, user_id, name, slug, description, status, logo_url, created_at, updated_at)
     VALUES (:id, :userId, :name, :slug, :description, 'active', NULL, :now, :now)`,
    {
      replacements: {
        id: organizationId,
        userId: user.id,
        name: organizationSeed.name,
        slug: organizationSeed.slug,
        description: organizationSeed.description,
        now,
      },
      transaction,
    }
  );

  await sequelize.query(
    `INSERT INTO wallet_wallets (id, user_id, balance, currency, created_at, updated_at)
     VALUES (:id, :userId, 0, 'INR', :now, :now)`,
    {
      replacements: {
        id: crypto.randomUUID(),
        userId: organizationId,
        now,
      },
      transaction,
    }
  );

  return organizationId;
}

function buildVerificationEmailPayload(user, verificationToken) {
  return {
    to_emails: [user.email],
    type: 'transactional',
    subject: 'Verify your email - Nyife',
    template_name: 'email_verification',
    variables: {
      name: user.first_name,
      verificationUrl: `${config.frontendUrl}/verify-email?token=${verificationToken}`,
    },
    meta: {
      source: 'auth_service',
      category: 'email_verification',
      user_id: user.id,
    },
  };
}

async function sendTransactionalEmail(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${config.emailServiceUrl}/api/v1/emails/send`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawBody = await response.text();
    const responseBody = rawBody ? JSON.parse(rawBody) : null;

    if (!response.ok) {
      throw new AppError(
        responseBody?.message || 'Unable to send the verification email right now. Please try again.',
        response.status || 503
      );
    }

    const emails = responseBody?.data?.emails || responseBody?.emails || [];
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new AppError(
        'Unable to confirm that the verification email was sent. Please try again.',
        503
      );
    }

    const failedEmail = emails.find((emailRecord) => emailRecord.status !== 'sent');
    if (failedEmail) {
      throw new AppError(
        failedEmail.error_message || 'Unable to send the verification email right now. Please try again.',
        503
      );
    }

    return emails;
  } catch (error) {
    if (error instanceof AppError || error?.isOperational) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new AppError(
        'Email service timed out while sending the verification email. Please try again.',
        503
      );
    }

    throw new AppError(
      'Unable to send the verification email right now. Please try again.',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function sendVerificationEmail(user, verificationToken) {
  return sendTransactionalEmail(buildVerificationEmailPayload(user, verificationToken));
}

async function rollbackPendingRegistration(userId, organizationId) {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      'DELETE FROM wallet_wallets WHERE user_id = :organizationId',
      {
        replacements: { organizationId },
        transaction,
      }
    );

    await sequelize.query(
      'DELETE FROM org_organizations WHERE id = :organizationId AND user_id = :userId',
      {
        replacements: { organizationId, userId },
        transaction,
      }
    );

    await User.destroy({
      where: { id: userId },
      force: true,
      transaction,
    });
  });
}

/**
 * Register a new user.
 */
async function register({ email, password, first_name, last_name, phone }) {
  const existing = await User.unscoped().findOne({ where: { email } });
  if (existing) {
    throw AppError.conflict('A user with this email already exists');
  }

  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const { user, organizationId } = await sequelize.transaction(async (transaction) => {
    const createdUser = await User.create({
      email,
      password,
      first_name,
      last_name,
      phone: phone || null,
      role: 'user',
      status: 'pending_verification',
      email_verification_token: emailVerificationToken,
      email_verification_expires: emailVerificationExpires,
    }, { transaction });

    const defaultOrganizationId = await createDefaultOrganizationForUser(createdUser, transaction);
    return {
      user: createdUser,
      organizationId: defaultOrganizationId,
    };
  });

  try {
    await sendVerificationEmail(user, emailVerificationToken);
  } catch (error) {
    try {
      await rollbackPendingRegistration(user.id, organizationId);
    } catch (rollbackError) {
      console.error('[auth-service] Failed to roll back registration after email failure:', rollbackError.message);
    }

    throw error;
  }

  return {
    user: user.toSafeJSON(),
    emailVerificationToken,
  };
}

/**
 * Verify email with token.
 */
async function verifyEmail(token) {
  const user = await User.unscoped().findOne({
    where: {
      email_verification_token: token,
      email_verification_expires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw AppError.badRequest('Invalid or expired verification token');
  }

  await user.update({
    email_verified_at: new Date(),
    email_verification_token: null,
    email_verification_expires: null,
    status: 'active',
  });

  return user.toSafeJSON();
}

async function resendVerificationEmail(userId) {
  const user = await User.unscoped().findOne({
    where: { id: userId },
  });

  if (!user) {
    throw AppError.notFound('Pending verification account not found');
  }

  if (user.email_verified_at || user.status === 'active') {
    throw AppError.badRequest('This email address has already been verified.');
  }

  if (user.status !== 'pending_verification') {
    throw AppError.badRequest('Only pending verification accounts can request a new email.');
  }

  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await user.update({
    email_verification_token: emailVerificationToken,
    email_verification_expires: emailVerificationExpires,
  });

  await sendVerificationEmail(user, emailVerificationToken);

  return {
    user: user.toSafeJSON(),
    emailVerificationToken,
  };
}

/**
 * Login user with email and password.
 */
async function login({ email, password, ip, userAgent }) {
  const user = await User.scope('withPassword').findOne({ where: { email } });

  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  if (user.status === 'pending_verification') {
    throw AppError.unauthorized('Please verify your email before logging in');
  }

  if (user.status === 'suspended') {
    throw AppError.unauthorized('Your account has been suspended');
  }

  if (user.status === 'inactive') {
    throw AppError.unauthorized('Your account is inactive');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Calculate refresh token expiry
  const refreshExpiryMs = parseExpiry(config.jwt.refreshExpiry);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  // Store refresh token
  await RefreshToken.create({
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
    device_info: userAgent || null,
    ip_address: ip || null,
  });

  // Update login metadata
  await user.update({
    last_login_at: new Date(),
    last_login_ip: ip || null,
    login_count: user.login_count + 1,
  });

  return {
    accessToken,
    refreshToken,
    user: user.toSafeJSON(),
  };
}

/**
 * Refresh access token using refresh token.
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw AppError.unauthorized('Refresh token is required');
  }

  const storedToken = await RefreshToken.findOne({
    where: {
      token: refreshToken,
      is_revoked: false,
      expires_at: { [Op.gt]: new Date() },
    },
    include: [{ model: User, as: 'user' }],
  });

  if (!storedToken) {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const user = storedToken.user;
  if (!user || user.status !== 'active') {
    throw AppError.unauthorized('User account is not active');
  }

  // Revoke old refresh token (rotation)
  await storedToken.update({ is_revoked: true });

  // Generate new tokens
  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  const refreshExpiryMs = parseExpiry(config.jwt.refreshExpiry);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  await RefreshToken.create({
    user_id: user.id,
    token: newRefreshToken,
    expires_at: expiresAt,
    device_info: storedToken.device_info,
    ip_address: storedToken.ip_address,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: user.toSafeJSON(),
  };
}

/**
 * Logout — revoke refresh token.
 */
async function logout(refreshToken) {
  if (!refreshToken) return;

  await RefreshToken.update(
    { is_revoked: true },
    { where: { token: refreshToken } }
  );
}

/**
 * Forgot password — generate reset token.
 */
async function forgotPassword(email) {
  const user = await User.unscoped().findOne({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) return { resetToken: null };

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await user.update({
    password_reset_token: resetToken,
    password_reset_expires: resetExpires,
  });

  return { resetToken, userId: user.id, email: user.email, firstName: user.first_name };
}

/**
 * Reset password with token.
 */
async function resetPassword(token, newPassword) {
  const user = await User.scope('withPassword').findOne({
    where: {
      password_reset_token: token,
      password_reset_expires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    throw AppError.badRequest('Invalid or expired reset token');
  }

  await user.update({
    password: newPassword,
    password_reset_token: null,
    password_reset_expires: null,
  });

  // Revoke all refresh tokens for this user
  await RefreshToken.update(
    { is_revoked: true },
    { where: { user_id: user.id } }
  );

  return user.toSafeJSON();
}

/**
 * Find or create user from OAuth provider.
 */
async function findOrCreateOAuthUser({ provider, providerId, email, firstName, lastName, avatarUrl }) {
  const providerField = provider === 'google' ? 'google_id' : 'facebook_id';

  // Check if user exists with this provider ID
  let user = await User.unscoped().findOne({ where: { [providerField]: providerId } });

  if (user) {
    // Existing OAuth user — generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    const refreshExpiryMs = parseExpiry(config.jwt.refreshExpiry);
    await RefreshToken.create({
      user_id: user.id,
      token: refreshToken,
      expires_at: new Date(Date.now() + refreshExpiryMs),
    });

    await user.update({
      last_login_at: new Date(),
      login_count: user.login_count + 1,
    });

    return { accessToken, refreshToken, user: user.toSafeJSON(), isNew: false };
  }

  // Check if user exists with same email
  user = await User.unscoped().findOne({ where: { email } });

  if (user) {
    // Link the OAuth account to existing user
    await user.update({ [providerField]: providerId });

    if (!user.email_verified_at) {
      await user.update({
        email_verified_at: new Date(),
        status: 'active',
        email_verification_token: null,
        email_verification_expires: null,
      });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    const refreshExpiryMs = parseExpiry(config.jwt.refreshExpiry);
    await RefreshToken.create({
      user_id: user.id,
      token: refreshToken,
      expires_at: new Date(Date.now() + refreshExpiryMs),
    });

    await user.update({
      last_login_at: new Date(),
      login_count: user.login_count + 1,
    });

    return { accessToken, refreshToken, user: user.toSafeJSON(), isNew: false };
  }

  // Create new user from OAuth
  user = await sequelize.transaction(async (transaction) => {
    const createdUser = await User.create({
      email,
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl || null,
      role: 'user',
      status: 'active',
      email_verified_at: new Date(),
      [providerField]: providerId,
    }, { transaction });

    await createDefaultOrganizationForUser(createdUser, transaction);
    return createdUser;
  });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  const refreshExpiryMs = parseExpiry(config.jwt.refreshExpiry);
  await RefreshToken.create({
    user_id: user.id,
    token: refreshToken,
    expires_at: new Date(Date.now() + refreshExpiryMs),
  });

  return { accessToken, refreshToken, user: user.toSafeJSON(), isNew: true };
}

/**
 * Get user by ID.
 */
async function getUserById(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }
  return user.toSafeJSON();
}

/**
 * Parse JWT expiry string (e.g., '15m', '7d') to milliseconds.
 */
function parseExpiry(expiry) {
  const match = String(expiry).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

module.exports = {
  register,
  verifyEmail,
  resendVerificationEmail,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  findOrCreateOAuthUser,
  getUserById,
};
