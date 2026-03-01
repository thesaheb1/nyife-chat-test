'use strict';

const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('@nyife/shared-utils');
const {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthTokenSchema,
} = require('../validations/auth.validation');
const config = require('../config');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

/**
 * POST /api/v1/auth/register
 */
async function register(req, res) {
  const data = registerSchema.parse(req.body);
  const result = await authService.register(data);

  // Publish email verification event to Kafka (best-effort, don't fail registration)
  try {
    if (req.app.locals.kafkaProducer) {
      const { publishEvent } = require('@nyife/shared-events');
      const { TOPICS } = require('@nyife/shared-events');
      await publishEvent(req.app.locals.kafkaProducer, TOPICS.EMAIL_SEND, result.user.id, {
        to: result.user.email,
        subject: 'Verify your email - Nyife',
        template: 'email-verification',
        templateData: {
          firstName: result.user.first_name,
          verificationUrl: `${config.frontendUrl}/verify-email?token=${result.emailVerificationToken}`,
        },
      });
    }
  } catch (err) {
    console.error('[auth-service] Failed to publish email verification event:', err.message);
  }

  return successResponse(res, { user: result.user }, 'Registration successful. Please check your email to verify your account.', 201);
}

/**
 * POST /api/v1/auth/verify-email
 */
async function verifyEmail(req, res) {
  const { token } = verifyEmailSchema.parse(req.body);
  const user = await authService.verifyEmail(token);
  return successResponse(res, { user }, 'Email verified successfully');
}

/**
 * POST /api/v1/auth/login
 */
async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  const result = await authService.login({
    email: data.email,
    password: data.password,
    ip,
    userAgent,
  });

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  // Cache user in Redis
  try {
    if (req.app.locals.redis) {
      await req.app.locals.redis.set(
        `user:${result.user.id}`,
        JSON.stringify(result.user),
        'EX',
        config.userCacheTtl
      );
    }
  } catch (err) {
    console.error('[auth-service] Redis cache error:', err.message);
  }

  return successResponse(res, {
    accessToken: result.accessToken,
    user: result.user,
  }, 'Login successful');
}

/**
 * POST /api/v1/auth/refresh
 */
async function refresh(req, res) {
  const refreshToken = req.cookies?.refreshToken;
  const result = await authService.refreshAccessToken(refreshToken);

  // Set new refresh token cookie
  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return successResponse(res, {
    accessToken: result.accessToken,
    user: result.user,
  }, 'Token refreshed successfully');
}

/**
 * POST /api/v1/auth/logout
 */
async function logout(req, res) {
  const refreshToken = req.cookies?.refreshToken;
  await authService.logout(refreshToken);

  // Clear cookie
  res.clearCookie('refreshToken', { path: '/' });

  // Clear user cache
  try {
    if (req.app.locals.redis && req.user) {
      await req.app.locals.redis.del(`user:${req.user.id}`);
    }
  } catch (err) {
    console.error('[auth-service] Redis cache clear error:', err.message);
  }

  return successResponse(res, null, 'Logged out successfully');
}

/**
 * POST /api/v1/auth/forgot-password
 */
async function forgotPassword(req, res) {
  const { email } = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(email);

  // Publish password reset email (best-effort)
  try {
    if (req.app.locals.kafkaProducer && result.resetToken) {
      const { publishEvent, TOPICS } = require('@nyife/shared-events');
      await publishEvent(req.app.locals.kafkaProducer, TOPICS.EMAIL_SEND, result.userId, {
        to: result.email,
        subject: 'Reset your password - Nyife',
        template: 'password-reset',
        templateData: {
          firstName: result.firstName,
          resetUrl: `${config.frontendUrl}/reset-password?token=${result.resetToken}`,
        },
      });
    }
  } catch (err) {
    console.error('[auth-service] Failed to publish password reset email:', err.message);
  }

  // Always return success to prevent email enumeration
  return successResponse(res, null, 'If an account with that email exists, a password reset link has been sent.');
}

/**
 * POST /api/v1/auth/reset-password
 */
async function resetPassword(req, res) {
  const { token, new_password } = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(token, new_password);
  return successResponse(res, null, 'Password reset successfully. Please login with your new password.');
}

/**
 * POST /api/v1/auth/google
 */
async function googleAuth(req, res) {
  const { access_token } = oauthTokenSchema.parse(req.body);

  // Verify Google token and get user info
  const axios = require('axios');
  let googleUser;
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    googleUser = response.data;
  } catch (err) {
    throw require('@nyife/shared-utils').AppError.unauthorized('Invalid Google access token');
  }

  const result = await authService.findOrCreateOAuthUser({
    provider: 'google',
    providerId: googleUser.sub,
    email: googleUser.email,
    firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
    lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
    avatarUrl: googleUser.picture,
  });

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return successResponse(res, {
    accessToken: result.accessToken,
    user: result.user,
    isNewUser: result.isNew,
  }, result.isNew ? 'Account created successfully' : 'Login successful');
}

/**
 * POST /api/v1/auth/facebook
 */
async function facebookAuth(req, res) {
  const { access_token } = oauthTokenSchema.parse(req.body);

  const axios = require('axios');
  let fbUser;
  try {
    const response = await axios.get(
      `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${access_token}`
    );
    fbUser = response.data;
  } catch (err) {
    throw require('@nyife/shared-utils').AppError.unauthorized('Invalid Facebook access token');
  }

  if (!fbUser.email) {
    throw require('@nyife/shared-utils').AppError.badRequest(
      'Facebook account must have an email address'
    );
  }

  const result = await authService.findOrCreateOAuthUser({
    provider: 'facebook',
    providerId: fbUser.id,
    email: fbUser.email,
    firstName: fbUser.first_name || 'User',
    lastName: fbUser.last_name || '',
    avatarUrl: fbUser.picture?.data?.url || null,
  });

  res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

  return successResponse(res, {
    accessToken: result.accessToken,
    user: result.user,
    isNewUser: result.isNew,
  }, result.isNew ? 'Account created successfully' : 'Login successful');
}

/**
 * GET /api/v1/auth/me
 */
async function getMe(req, res) {
  // Try Redis cache first
  try {
    if (req.app.locals.redis) {
      const cached = await req.app.locals.redis.get(`user:${req.user.id}`);
      if (cached) {
        return successResponse(res, { user: JSON.parse(cached) }, 'User profile retrieved');
      }
    }
  } catch (err) {
    console.error('[auth-service] Redis read error:', err.message);
  }

  const user = await authService.getUserById(req.user.id);

  // Cache for next time
  try {
    if (req.app.locals.redis) {
      await req.app.locals.redis.set(
        `user:${req.user.id}`,
        JSON.stringify(user),
        'EX',
        config.userCacheTtl
      );
    }
  } catch (err) {
    console.error('[auth-service] Redis cache error:', err.message);
  }

  return successResponse(res, { user }, 'User profile retrieved');
}

module.exports = {
  register,
  verifyEmail,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  googleAuth,
  facebookAuth,
  getMe,
};
