'use strict';

const { z } = require('zod');

// ────────────────────────────────────────────────
// User: Create ticket
// ────────────────────────────────────────────────
const createTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be at most 500 characters'),
  description: z.string().min(1, 'Description is required'),
  category: z.enum(['billing', 'technical', 'account', 'whatsapp', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

// ────────────────────────────────────────────────
// User: List tickets
// ────────────────────────────────────────────────
const listTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
  category: z.enum(['billing', 'technical', 'account', 'whatsapp', 'other']).optional(),
});

// ────────────────────────────────────────────────
// Reply to ticket (user or admin)
// ────────────────────────────────────────────────
const replyTicketSchema = z.object({
  body: z.string().min(1, 'Reply body is required'),
  attachments: z.array(z.string().url()).optional(),
});

// ────────────────────────────────────────────────
// Rate ticket (user only, after resolution)
// ────────────────────────────────────────────────
const rateTicketSchema = z.object({
  satisfaction_rating: z.number().int().min(1).max(5),
  satisfaction_feedback: z.string().max(2000).optional(),
});

// ────────────────────────────────────────────────
// Admin: List tickets (advanced filters)
// ────────────────────────────────────────────────
const adminListTicketsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  category: z.enum(['billing', 'technical', 'account', 'whatsapp', 'other']).optional(),
  assigned_to: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

// ────────────────────────────────────────────────
// Admin: Assign ticket
// ────────────────────────────────────────────────
const assignTicketSchema = z.object({
  admin_user_id: z.string().uuid('Invalid admin user ID'),
});

// ────────────────────────────────────────────────
// Admin: Update ticket status
// ────────────────────────────────────────────────
const updateTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']),
});

// ────────────────────────────────────────────────
// Param validators
// ────────────────────────────────────────────────
const idParamSchema = z.object({
  id: z.string().uuid('Invalid ticket ID'),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

module.exports = {
  createTicketSchema,
  listTicketsSchema,
  replyTicketSchema,
  rateTicketSchema,
  adminListTicketsSchema,
  assignTicketSchema,
  updateTicketStatusSchema,
  idParamSchema,
  userIdParamSchema,
};
