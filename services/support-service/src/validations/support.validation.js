'use strict';

const { z } = require('zod');

const statusEnum = z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']);
const categoryEnum = z.enum(['billing', 'technical', 'account', 'whatsapp', 'other']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const unreadFilterSchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    return value === 'true';
  })
  .optional();

const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be at most 500 characters'),
  description: z.string().min(1, 'Description is required'),
  category: categoryEnum,
  priority: priorityEnum.default('medium'),
  attachments: z.array(z.string().url()).max(10).optional(),
});

const listTicketsSchema = z.object({
  ...paginationFields,
  status: statusEnum.optional(),
  category: categoryEnum.optional(),
  search: z.string().max(255).optional(),
  unread: unreadFilterSchema,
  organization_id: z.string().uuid().optional(),
});

const listMessagesSchema = z.object({
  ...paginationFields,
});

const replyTicketSchema = z.object({
  body: z.string().min(1, 'Reply body is required'),
  attachments: z.array(z.string().url()).max(10).optional(),
});

const rateTicketSchema = z.object({
  satisfaction_rating: z.number().int().min(1).max(5),
  satisfaction_feedback: z.string().max(2000).optional(),
});

const adminListTicketsSchema = z.object({
  ...paginationFields,
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  category: categoryEnum.optional(),
  assigned_to: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  unread: unreadFilterSchema,
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const assignTicketSchema = z.object({
  admin_user_id: z.string().uuid('Invalid admin user ID'),
});

const updateTicketStatusSchema = z.object({
  status: statusEnum,
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ticket ID'),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

module.exports = {
  createTicketSchema,
  listTicketsSchema,
  listMessagesSchema,
  replyTicketSchema,
  rateTicketSchema,
  adminListTicketsSchema,
  assignTicketSchema,
  updateTicketStatusSchema,
  idParamSchema,
  userIdParamSchema,
};
