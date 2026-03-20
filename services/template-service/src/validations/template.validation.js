'use strict';

const { z } = require('zod');
const {
  META_TEMPLATE_LANGUAGE_CODES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUSES,
  TEMPLATE_TYPES,
} = require('../constants/template.constants');

const templateNameRegex = /^[a-z][a-z0-9_]*$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEADER_FORMATS = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'];
const BUTTON_TYPES = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'OTP', 'FLOW', 'CATALOG', 'MPM'];
const FLOW_ACTIONS = ['navigate', 'data_exchange'];

const metaLanguageSchema = z.enum(META_TEMPLATE_LANGUAGE_CODES, {
  errorMap: () => ({ message: 'Language must be one of the Meta-supported WhatsApp template locales' }),
});

const metaWabaIdSchema = z
  .string()
  .regex(/^\d+$/, 'WABA ID must contain only digits')
  .max(100, 'WABA ID must be at most 100 characters');

const uuidSchema = z.string().regex(uuidRegex, 'Invalid UUID format');

const mediaAssetSchema = z.object({
  file_id: z.string().trim().optional(),
  original_name: z.string().trim().optional(),
  mime_type: z.string().trim().optional(),
  size: z.number().nonnegative().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'other']).optional(),
  preview_url: z.string().trim().optional(),
  header_handle: z.string().trim().optional().nullable(),
}).passthrough();

const buttonSchema = z.object({
  type: z.enum(BUTTON_TYPES),
  text: z.string().trim().min(1).max(25).optional(),
  url: z.string().trim().url().max(2000).optional(),
  phone_number: z.string().trim().regex(/^\+?[1-9]\d{6,14}$/, 'Phone number must be in international format').optional(),
  example: z.union([z.string(), z.array(z.string())]).optional(),
  flow_id: z.string().optional(),
  flow_name: z.string().optional(),
  flow_action: z.enum(FLOW_ACTIONS).optional(),
  flow_json: z.string().optional(),
  navigate_screen: z.string().optional(),
  otp_type: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']).optional(),
  autofill_text: z.string().trim().max(25).optional(),
  package_name: z.string().trim().max(255).optional(),
  signature_hash: z.string().trim().max(255).optional(),
}).passthrough();

const componentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS', 'CAROUSEL', 'LIMITED_TIME_OFFER']),
  format: z.enum(HEADER_FORMATS).optional(),
  text: z.string().trim().max(1024).optional(),
  example: z.object({
    header_text: z.array(z.string()).optional(),
    body_text: z.array(z.array(z.string())).optional(),
    header_handle: z.array(z.string()).optional(),
  }).passthrough().optional(),
  media_asset: mediaAssetSchema.optional(),
  buttons: z.array(buttonSchema).optional(),
  cards: z.array(z.object({
    components: z.array(z.lazy(() => componentSchema)).optional(),
  }).passthrough()).optional(),
  add_security_recommendation: z.boolean().optional(),
  code_expiration_minutes: z.number().int().min(1).max(90).optional(),
}).passthrough();

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
  language: metaLanguageSchema.default('en_US'),
  category: z
    .enum(TEMPLATE_CATEGORIES, {
      errorMap: () => ({ message: `Category must be one of: ${TEMPLATE_CATEGORIES.join(', ')}` }),
    }),
  type: z
    .enum(TEMPLATE_TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${TEMPLATE_TYPES.join(', ')}` }),
    })
    .default('standard'),
  components: z
    .array(componentSchema)
    .min(1, 'At least one component is required'),
  example_values: z
    .record(z.any())
    .optional()
    .nullable(),
  wa_account_id: uuidSchema.optional().nullable(),
});

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
  language: metaLanguageSchema.optional(),
  category: z
    .enum(TEMPLATE_CATEGORIES, {
      errorMap: () => ({ message: `Category must be one of: ${TEMPLATE_CATEGORIES.join(', ')}` }),
    })
    .optional(),
  type: z
    .enum(TEMPLATE_TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${TEMPLATE_TYPES.join(', ')}` }),
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
  wa_account_id: uuidSchema.optional().nullable(),
});

const listTemplatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(TEMPLATE_STATUSES, {
      errorMap: () => ({ message: `Status must be one of: ${TEMPLATE_STATUSES.join(', ')}` }),
    })
    .optional(),
  category: z
    .enum(TEMPLATE_CATEGORIES, {
      errorMap: () => ({ message: `Category must be one of: ${TEMPLATE_CATEGORIES.join(', ')}` }),
    })
    .optional(),
  type: z
    .enum(TEMPLATE_TYPES, {
      errorMap: () => ({ message: `Type must be one of: ${TEMPLATE_TYPES.join(', ')}` }),
    })
    .optional(),
  search: z.string().max(255).optional(),
  waba_id: metaWabaIdSchema.optional(),
  wa_account_id: uuidSchema.optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

const publishTemplateSchema = z.object({
  wa_account_id: uuidSchema.optional(),
});

const syncTemplatesSchema = z.object({
  wa_account_id: uuidSchema.optional(),
});

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
