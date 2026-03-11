'use strict';

const { z } = require('zod');

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
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g., +919876543210)')
    .optional()
    .nullable(),
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
      .min(8, 'New password must be at least 8 characters')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/,
        'New password must contain at least one special character'
      ),
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
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

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  updateSettingsSchema,
  createApiTokenSchema,
  resolveApiTokenSchema,
};
