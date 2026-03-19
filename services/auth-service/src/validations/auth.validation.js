'use strict';

const { z } = require('zod');
const { strongPasswordRegex, strongPasswordMessage } = require('@nyife/shared-utils');

const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  password: z.string().regex(strongPasswordRegex, strongPasswordMessage),
  first_name: z.string().min(2, 'First name must be at least 2 characters').max(100).trim(),
  last_name: z.string().min(2, 'Last name must be at least 2 characters').max(100).trim(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number (E.164 format required)')
    .optional()
    .nullable(),
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
