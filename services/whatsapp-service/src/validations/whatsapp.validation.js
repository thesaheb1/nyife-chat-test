'use strict';

const { z } = require('zod');

/**
 * Schema for embedded signup — the frontend SDK returns a code to exchange.
 */
const embeddedSignupSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
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

/**
 * Schema for webhook verification query parameters (GET /webhook).
 */
const webhookVerifySchema = z.object({
  'hub.mode': z.string().min(1, 'hub.mode is required'),
  'hub.verify_token': z.string().min(1, 'hub.verify_token is required'),
  'hub.challenge': z.string().min(1, 'hub.challenge is required'),
});

module.exports = {
  embeddedSignupSchema,
  sendMessageSchema,
  sendTemplateSchema,
  listMessagesSchema,
  contactPhoneParamSchema,
  accountIdParamSchema,
  webhookVerifySchema,
};
