'use strict';

const supportService = require('../services/support.service');
const { successResponse, AppError } = require('@nyife/shared-utils');
const {
  createTicketSchema,
  listTicketsSchema,
  replyTicketSchema,
  rateTicketSchema,
  adminListTicketsSchema,
  assignTicketSchema,
  updateTicketStatusSchema,
  idParamSchema,
  userIdParamSchema,
} = require('../validations/support.validation');

function getSupportUserContext(req) {
  const actorUserId = req.headers['x-user-id'] || req.user?.id || req.user?.userId || null;
  const organizationId = req.organizationId || req.headers['x-organization-id'] || null;

  if (!actorUserId) {
    throw AppError.unauthorized('Authentication is required to access support.', 'AUTH_REQUIRED');
  }

  if (!organizationId) {
    throw AppError.forbidden(
      'Select an organization before using support.',
      'ORG_CONTEXT_REQUIRED'
    );
  }

  return {
    actorUserId,
    organizationId,
  };
}

// ────────────────────────────────────────────────
// User Handlers
// ────────────────────────────────────────────────

/**
 * POST /api/v1/support/tickets
 * Creates a new support ticket for the authenticated user.
 */
async function createTicket(req, res) {
  const { actorUserId, organizationId } = getSupportUserContext(req);
  const data = createTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;

  const ticket = await supportService.createTicket(actorUserId, organizationId, data, kafkaProducer);

  return successResponse(res, { ticket }, 'Support ticket created successfully', 201);
}

/**
 * GET /api/v1/support/tickets
 * Lists tickets for the authenticated user with pagination and optional filters.
 */
async function listTickets(req, res) {
  const { organizationId } = getSupportUserContext(req);
  const filters = listTicketsSchema.parse(req.query);

  const { tickets, meta } = await supportService.listUserTickets(organizationId, filters);

  return successResponse(res, { tickets }, 'Tickets retrieved', 200, meta);
}

/**
 * GET /api/v1/support/tickets/:id
 * Gets a single ticket with all replies for the authenticated user.
 */
async function getTicket(req, res) {
  const { organizationId } = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);

  const ticket = await supportService.getTicket(organizationId, id);

  return successResponse(res, { ticket }, 'Ticket retrieved');
}

/**
 * POST /api/v1/support/tickets/:id/reply
 * Adds a user reply to a ticket.
 */
async function replyToTicket(req, res) {
  const { actorUserId, organizationId } = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const data = replyTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;

  const reply = await supportService.replyToTicket(organizationId, actorUserId, id, data, kafkaProducer);

  return successResponse(res, { reply }, 'Reply added successfully', 201);
}

/**
 * PUT /api/v1/support/tickets/:id/close
 * Closes a user's ticket.
 */
async function closeTicket(req, res) {
  const { organizationId } = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);

  const ticket = await supportService.closeTicket(organizationId, id);

  return successResponse(res, { ticket }, 'Ticket closed successfully');
}

/**
 * PUT /api/v1/support/tickets/:id/rate
 * Rates a resolved or closed ticket.
 */
async function rateTicket(req, res) {
  const { organizationId } = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const data = rateTicketSchema.parse(req.body);

  const ticket = await supportService.rateTicket(organizationId, id, data);

  return successResponse(res, { ticket }, 'Ticket rated successfully');
}

// ────────────────────────────────────────────────
// Admin Handlers
// ────────────────────────────────────────────────

/**
 * GET /api/v1/admin/support/tickets
 * Lists all tickets with advanced filters, search, and pagination (admin).
 */
async function adminListTickets(req, res) {
  const filters = adminListTicketsSchema.parse(req.query);

  const { tickets, meta } = await supportService.adminListTickets(filters);

  return successResponse(res, { tickets }, 'Tickets retrieved', 200, meta);
}

/**
 * GET /api/v1/admin/support/tickets/:id
 * Gets a single ticket with replies and user information (admin).
 */
async function adminGetTicket(req, res) {
  const { id } = idParamSchema.parse(req.params);

  const ticketData = await supportService.adminGetTicket(id);
  const { replies, ...ticket } = ticketData;

  return successResponse(res, { ticket, replies: replies || [] }, 'Ticket retrieved');
}

/**
 * POST /api/v1/admin/support/tickets/:id/reply
 * Adds an admin reply to a ticket.
 */
async function adminReplyToTicket(req, res) {
  const adminUserId = req.headers['x-user-id'];
  const { id } = idParamSchema.parse(req.params);
  const data = replyTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;

  const reply = await supportService.adminReplyToTicket(adminUserId, id, data, kafkaProducer);

  return successResponse(res, { reply }, 'Admin reply added successfully', 201);
}

/**
 * PUT /api/v1/admin/support/tickets/:id/assign
 * Assigns a ticket to an admin user.
 */
async function assignTicket(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { admin_user_id } = assignTicketSchema.parse(req.body);

  const ticket = await supportService.assignTicket(id, admin_user_id);

  return successResponse(res, { ticket }, 'Ticket assigned successfully');
}

/**
 * PUT /api/v1/admin/support/tickets/:id/status
 * Updates the status of a ticket.
 */
async function updateTicketStatus(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { status } = updateTicketStatusSchema.parse(req.body);

  const ticket = await supportService.updateTicketStatus(id, status);

  return successResponse(res, { ticket }, 'Ticket status updated successfully');
}

/**
 * GET /api/v1/admin/support/tickets/user/:userId
 * Lists all tickets for a specific user (admin view).
 */
async function getTicketsByUser(req, res) {
  const { userId } = userIdParamSchema.parse(req.params);
  const filters = listTicketsSchema.parse(req.query);

  const { tickets, meta } = await supportService.getTicketsByUser(userId, filters);

  return successResponse(res, { tickets }, 'User tickets retrieved', 200, meta);
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  replyToTicket,
  closeTicket,
  rateTicket,
  adminListTickets,
  adminGetTicket,
  adminReplyToTicket,
  assignTicket,
  updateTicketStatus,
  getTicketsByUser,
};
