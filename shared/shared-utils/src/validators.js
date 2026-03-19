'use strict';

const { z } = require('zod');

/**
 * Validates an E.164 formatted phone number.
 * Must start with '+' followed by 7-15 digits, first digit after '+' cannot be 0.
 * Examples: +14155552671, +919876543210
 */
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Invalid phone number (E.164 format required)');

const optionalPhoneSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}, phoneSchema.nullable().optional());

/**
 * Canonical strong-password policy shared across services.
 * Requires at least 8 characters, uppercase, lowercase, number, and symbol.
 */
const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
const strongPasswordMessage =
  'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character';

/**
 * Validates and normalizes an email address to lowercase.
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase();

/**
 * Validates a UUID v4 string.
 */
const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

/**
 * Validates pagination query parameters with sensible defaults.
 * - page: integer >= 1, defaults to 1
 * - limit: integer between 1 and 100, defaults to 20
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Validates an optional date range, ensuring startDate is before or equal to endDate.
 */
const dateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'startDate must be before endDate' }
  );

/**
 * Validates an optional search query string, trimmed of whitespace.
 */
const searchSchema = z.object({
  search: z.string().trim().optional(),
});

module.exports = {
  phoneSchema,
  optionalPhoneSchema,
  emailSchema,
  uuidSchema,
  paginationSchema,
  dateRangeSchema,
  searchSchema,
  strongPasswordRegex,
  strongPasswordMessage,
};
