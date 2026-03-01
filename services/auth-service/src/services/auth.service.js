'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, RefreshToken } = require('../models');
const { AppError } = require('@nyife/shared-utils');
const config = require('../config');

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

  const user = await User.create({
    email,
    password,
    first_name,
    last_name,
    phone: phone || null,
    role: 'user',
    status: 'pending_verification',
    email_verification_token: emailVerificationToken,
    email_verification_expires: emailVerificationExpires,
  });

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
  user = await User.create({
    email,
    first_name: firstName,
    last_name: lastName,
    avatar_url: avatarUrl || null,
    role: 'user',
    status: 'active',
    email_verified_at: new Date(),
    [providerField]: providerId,
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
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  findOrCreateOAuthUser,
  getUserById,
};
