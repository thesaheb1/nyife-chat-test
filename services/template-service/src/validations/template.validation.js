'use strict';

const { z } = require('zod');

/**
 * Regex for Meta template names: lowercase letters, digits, underscores only.
 * Must start with a letter.
 */
const templateNameRegex = /^[a-z][a-z0-9_]*$/;

/**
 * UUID v4 format regex
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valid template categories (Meta WhatsApp API values)
 */
const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

/**
 * Valid template types
 */
const TYPES = ['standard', 'authentication', 'carousel', 'flow', 'list_menu'];

/**
 * Valid template statuses
 */
const STATUSES = ['draft', 'pending', 'approved', 'rejected', 'paused', 'disabled'];

/**
 * Valid header formats for HEADER component
 */
const HEADER_FORMATS = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'];

/**
 * Valid button types
 */
const BUTTON_TYPES = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'OTP', 'FLOW', 'CATALOG', 'MPM', 'COPY_CODE'];

// ─── Component Schema (flexible, Meta will validate on publish) ────────────

const buttonSchema = z.object({
  type: z.enum(BUTTON_TYPES),
  text: z.string().max(200).optional(),
  url: z.string().url().optional(),
  phone_number: z.string().optional(),
  example: z.union([z.string(), z.array(z.string())]).optional(),
  flow_id: z.string().optional(),
  flow_name: z.string().optional(),
  flow_action: z.string().optional(),
  flow_json: z.string().optional(),
  navigate_screen: z.string().optional(),
  otp_type: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']).optional(),
  autofill_text: z.string().optional(),
  package_name: z.string().optional(),
  signature_hash: z.string().optional(),
}).passthrough();

const componentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS', 'CAROUSEL', 'LIMITED_TIME_OFFER']),
  format: z.enum(HEADER_FORMATS).optional(),
  text: z.string().optional(),
  example: z.object({
    header_text: z.array(z.string()).optional(),
    body_text: z.array(z.array(z.string())).optional(),
    header_handle: z.array(z.string()).optional(),
  }).passthrough().optional(),
  buttons: z.array(buttonSchema).optional(),
  cards: z.array(z.object({
    components: z.array(z.lazy(() => componentSchema)).optional(),
  }).passthrough()).optional(),
  add_security_recommendation: z.boolean().optional(),
  code_expiration_minutes: z.number().int().min(1).max(90).optional(),
}).passthrough();

// ─── Create Template Schema ────────────────────────────────────────────────

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(512, 'Template name must be at most 512 characters')
    .regex(templateNameRegex, 'Template name must be lowercase, start with a letter, and contain only letters, digits, and underscores'),
  display_name: z
    .string()
    .max(512, 'Display name must be at most 512 characters')
    .optional()
    .nullable(),
  language: z
    .string()
    .min(2, 'Language code must be at least 2 characters')
    .max(20, 'Language code must be at most 20 characters')
    .default('en_US'),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(', ')}` }),
  }),
  type: z
    .enum(TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${TYPES.join(', ')}` }),
    })
    .default('standard'),
  components: z
    .array(componentSchema)
    .min(1, 'At least one component is required'),
  example_values: z
    .record(z.any())
    .optional()
    .nullable(),
  waba_id: z
    .string()
    .max(100, 'WABA ID must be at most 100 characters')
    .optional()
    .nullable(),
});

// ─── Update Template Schema ────────────────────────────────────────────────

const updateTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(512, 'Template name must be at most 512 characters')
    .regex(templateNameRegex, 'Template name must be lowercase, start with a letter, and contain only letters, digits, and underscores')
    .optional(),
  display_name: z
    .string()
    .max(512, 'Display name must be at most 512 characters')
    .optional()
    .nullable(),
  language: z
    .string()
    .min(2, 'Language code must be at least 2 characters')
    .max(20, 'Language code must be at most 20 characters')
    .optional(),
  category: z
    .enum(CATEGORIES, {
      errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(', ')}` }),
    })
    .optional(),
  type: z
    .enum(TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${TYPES.join(', ')}` }),
    })
    .optional(),
  components: z
    .array(componentSchema)
    .min(1, 'At least one component is required')
    .optional(),
  example_values: z
    .record(z.any())
    .optional()
    .nullable(),
  waba_id: z
    .string()
    .max(100, 'WABA ID must be at most 100 characters')
    .optional()
    .nullable(),
});

// ─── List Templates Schema (query params) ──────────────────────────────────

const listTemplatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(STATUSES, {
      errorMap: () => ({ message: `Status must be one of: ${STATUSES.join(', ')}` }),
    })
    .optional(),
  category: z
    .enum(CATEGORIES, {
      errorMap: () => ({ message: `Category must be one of: ${CATEGORIES.join(', ')}` }),
    })
    .optional(),
  type: z
    .enum(TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${TYPES.join(', ')}` }),
    })
    .optional(),
  search: z.string().max(255).optional(),
  waba_id: z.string().max(100).optional(),
});

// ─── Publish Template Schema ───────────────────────────────────────────────

const publishTemplateSchema = z.object({
  waba_id: z
    .string()
    .min(1, 'WABA ID is required for publishing')
    .max(100)
    .optional(),
});

// ─── Sync Templates Schema ────────────────────────────────────────────────

const syncTemplatesSchema = z.object({
  waba_id: z
    .string()
    .min(1, 'WABA ID is required for syncing')
    .max(100),
});

// ─── Template ID Param Schema ──────────────────────────────────────────────

const templateIdSchema = z.object({
  id: z.string().regex(uuidRegex, 'Invalid template ID format (UUID expected)'),
});

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesSchema,
  publishTemplateSchema,
  syncTemplatesSchema,
  templateIdSchema,
};
