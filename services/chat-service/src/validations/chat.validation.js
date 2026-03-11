'use strict';

const { z } = require('zod');

/**
 * Schema for listing conversations with filters and pagination.
 * Used on GET /conversations
 */
const listConversationsSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  status: z.enum(['open', 'closed', 'pending']).optional(),
  assigned_to: z.union([z.string().uuid(), z.literal('unassigned')]).optional(),
  unread: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined || val === '') return undefined;
      return val === 'true';
    }),
  search: z.string().max(200).optional(),
  wa_account_id: z.string().uuid().optional(),
});

/**
 * Schema for validating a conversation ID path parameter.
 */
const conversationIdSchema = z.object({
  id: z.string().uuid('Invalid conversation ID format'),
});

/**
 * Schema for sending a message within a conversation.
 * Used on POST /conversations/:id/send
 */
const sendMessageSchema = z.object({
  type: z.enum([
    'text',
    'image',
    'video',
    'audio',
    'document',
    'location',
    'contacts',
    'interactive',
    'template',
    'sticker',
    'reaction',
  ]),
  message: z.record(z.any()).refine((val) => Object.keys(val).length > 0, {
    message: 'Message payload cannot be empty',
  }),
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID'),
});

/**
 * Schema for assigning a conversation to a team member.
 * Used on POST /conversations/:id/assign
 */
const assignConversationSchema = z.object({
  member_user_id: z.string().uuid('Invalid member user ID format').nullable(),
});

/**
 * Schema for updating conversation status.
 * Used on PUT /conversations/:id/status
 */
const updateConversationStatusSchema = z.object({
  status: z.enum(['open', 'closed', 'pending']),
});

/**
 * Schema for listing messages in a conversation with pagination.
 * Used on GET /conversations/:id/messages
 */
const listMessagesSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  before: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
});

module.exports = {
  listConversationsSchema,
  conversationIdSchema,
  sendMessageSchema,
  assignConversationSchema,
  updateConversationStatusSchema,
  listMessagesSchema,
};
