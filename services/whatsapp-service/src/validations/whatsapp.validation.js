'use strict';

const { z } = require('zod');

/**
 * Schema for the preview step of embedded signup — exchanges the Meta code and
 * returns discovered phone numbers without persisting them yet.
 */
const embeddedSignupPreviewSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

/**
 * Schema for the completion step of embedded signup — selects phone numbers to
 * register and stores the connected accounts.
 */
const embeddedSignupCompleteSchema = z.object({
  signup_session_id: z.string().uuid('Invalid signup session ID'),
  phone_number_ids: z
    .array(z.string().min(1, 'Phone number ID is required'))
    .min(1, 'Select at least one phone number'),
});

/**
 * Schema for sending a direct (non-template) message.
 */
const sendMessageSchema = z.object({
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID'),
  to: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number (E.164 format expected)'),
  type: z.enum([
    'text',
    'image',
    'video',
    'audio',
    'document',
    'sticker',
    'location',
    'contacts',
    'reaction',
    'interactive',
    'template',
  ]),
  message: z.record(z.any()).refine((val) => Object.keys(val).length > 0, {
    message: 'Message payload cannot be empty',
  }),
  context: z
    .object({
      message_id: z.string().min(1, 'Context message_id is required'),
    })
    .optional(),
});

/**
 * Schema for sending a pre-configured template message.
 */
const sendTemplateSchema = z.object({
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID'),
  to: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number (E.164 format expected)'),
  template_id: z.string().uuid('Invalid template ID'),
  variables: z.record(z.any()).optional(),
});

/**
 * Schema for sending a WhatsApp Flow message.
 */
const sendFlowSchema = z.object({
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID'),
  to: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number (E.164 format expected)'),
  flow_id: z.string().min(1, 'Flow ID is required'),
  flow_cta: z.string().min(1).max(30),
  flow_token: z.string().max(255).optional(),
  flow_message_version: z.string().max(10).optional(),
  flow_action: z.enum(['navigate', 'data_exchange']).optional(),
  flow_action_payload: z.record(z.any()).optional(),
  body_text: z.string().max(1024).optional(),
  header_text: z.string().max(60).optional(),
  footer_text: z.string().max(60).optional(),
});

/**
 * Schema for listing messages with filters and pagination.
 */
const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['inbound', 'outbound']).optional(),
  type: z.string().max(50).optional(),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'failed']).optional(),
  contact_phone: z.string().max(20).optional(),
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID').optional(),
  date_from: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  date_to: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Schema for contact phone param (in conversation endpoint).
 */
const contactPhoneParamSchema = z.object({
  contactPhone: z
    .string()
    .min(7, 'Contact phone must be at least 7 characters')
    .max(20, 'Contact phone must be at most 20 characters'),
});

/**
 * Schema for account ID URL parameter.
 */
const accountIdParamSchema = z.object({
  id: z.string().uuid('Invalid account ID'),
});

const reconcileAccountSchema = z.object({
  force: z.boolean().optional(),
}).optional();

/**
 * Schema for webhook verification query parameters (GET /webhook).
 */
const webhookVerifySchema = z.object({
  'hub.mode': z.string().min(1, 'hub.mode is required'),
  'hub.verify_token': z.string().min(1, 'hub.verify_token is required'),
  'hub.challenge': z.string().min(1, 'hub.challenge is required'),
});

const flowDataExchangeSchema = z.object({}).passthrough();

module.exports = {
  embeddedSignupPreviewSchema,
  embeddedSignupCompleteSchema,
  sendMessageSchema,
  sendTemplateSchema,
  sendFlowSchema,
  listMessagesSchema,
  contactPhoneParamSchema,
  accountIdParamSchema,
  reconcileAccountSchema,
  webhookVerifySchema,
  flowDataExchangeSchema,
};
