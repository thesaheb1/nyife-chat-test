'use strict';

const { z } = require('zod');
const {
  optionalPhoneSchema,
  strongPasswordRegex,
  strongPasswordMessage,
} = require('@nyife/shared-utils');

const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().regex(strongPasswordRegex, strongPasswordMessage),
  first_name: z.string().trim().min(2, 'First name must be at least 2 characters').max(100),
  last_name: z.string().trim().min(2, 'Last name must be at least 2 characters').max(100),
  phone: optionalPhoneSchema,
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

const resendVerificationSchema = z.object({
  user_id: z.string().uuid('Valid user ID is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: z.string().regex(strongPasswordRegex, strongPasswordMessage),
});

const oauthTokenSchema = z.object({
  access_token: z.string().min(1, 'OAuth access token is required'),
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthTokenSchema,
};
