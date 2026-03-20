'use strict';

const { z } = require('zod');
const {
  optionalPhoneSchema,
  strongPasswordRegex,
  strongPasswordMessage,
} = require('@nyife/shared-utils');

// ---------------------------------------------------------------------------
// Profile validation schemas
// ---------------------------------------------------------------------------

/**
 * Schema for updating user profile fields on auth_users.
 * Only allows first_name, last_name, and an optional phone number.
 */
const updateProfileSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be at most 50 characters'),
  last_name: z
    .string()
    .trim()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be at most 50 characters'),
  phone: optionalPhoneSchema,
});

/**
 * Schema for changing the user's password.
 * Requires the current password and enforces a strong new password policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
const changePasswordSchema = z
  .object({
    current_password: z
      .string()
      .min(1, 'Current password is required'),
    new_password: z
      .string()
      .regex(strongPasswordRegex, strongPasswordMessage),
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  });

const forceChangePasswordSchema = z.object({
  new_password: z
    .string()
    .regex(strongPasswordRegex, strongPasswordMessage),
});

// ---------------------------------------------------------------------------
// Settings validation schema
// ---------------------------------------------------------------------------

/**
 * Schema for updating user settings (all fields optional — partial update).
 */
const updateSettingsSchema = z.object({
  language: z
    .string()
    .trim()
    .min(2, 'Language code must be at least 2 characters')
    .max(10, 'Language code must be at most 10 characters')
    .optional(),
  timezone: z
    .string()
    .trim()
    .min(1, 'Timezone is required')
    .max(50, 'Timezone must be at most 50 characters')
    .optional(),
  theme: z
    .enum(['light', 'dark', 'system'], {
      errorMap: () => ({ message: 'Theme must be one of: light, dark, system' }),
    })
    .optional(),
  notification_email: z.boolean().optional(),
  notification_push: z.boolean().optional(),
  notification_in_app: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// API Token validation schemas
// ---------------------------------------------------------------------------

/**
 * Schema for creating a new API token.
 */
const createApiTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Token name is required')
    .max(100, 'Token name must be at most 100 characters'),
  permissions: z
    .record(z.any())
    .optional()
    .nullable(),
  expires_at: z
    .string()
    .datetime({ message: 'expires_at must be a valid ISO 8601 date string' })
    .optional()
    .nullable(),
});

const resolveApiTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, 'API token is required'),
});

const listApiTokensSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(['active', 'revoked']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  forceChangePasswordSchema,
  updateSettingsSchema,
  createApiTokenSchema,
  listApiTokensSchema,
  resolveApiTokenSchema,
};
