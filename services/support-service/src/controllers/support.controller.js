'use strict';

const supportService = require('../services/support.service');
const { successResponse, AppError } = require('@nyife/shared-utils');
const {
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

  return supportService.buildUserViewer(actorUserId, organizationId);
}

function getSupportAdminContext(req) {
  const actor = req.adminUser || null;
  if (!actor && !req.headers['x-user-id']) {
    throw AppError.unauthorized('Authentication is required to access support.', 'AUTH_REQUIRED');
  }

  return supportService.buildAdminViewer(
    actor || {
      user: { id: req.headers['x-user-id'] || req.user?.id || null },
      is_super_admin: req.headers['x-user-role'] === 'super_admin',
      permissions: { resources: { support: { read: true, update: true, delete: true } } },
    }
  );
}

async function createTicket(req, res) {
  const viewer = getSupportUserContext(req);
  const data = createTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;
  const io = req.app.locals.io || null;

  const result = await supportService.createTicket(
    viewer.user_id,
    viewer.organization_id,
    data,
    io,
    kafkaProducer
  );

  return successResponse(res, result, 'Support ticket created successfully', 201);
}

async function listTickets(req, res) {
  const viewer = getSupportUserContext(req);
  const filters = listTicketsSchema.parse(req.query);
  const { tickets, meta } = await supportService.listUserTickets(viewer, filters);
  return successResponse(res, { tickets }, 'Tickets retrieved', 200, meta);
}

async function getTicket(req, res) {
  const viewer = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const result = await supportService.getUserTicket(viewer, id);
  return successResponse(res, result, 'Ticket retrieved');
}

async function getTicketMessages(req, res) {
  const viewer = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const filters = listMessagesSchema.parse(req.query);
  const { messages, meta } = await supportService.getUserTicketMessages(viewer, id, filters);
  return successResponse(res, { messages }, 'Messages retrieved', 200, meta);
}

async function markTicketRead(req, res) {
  const viewer = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const io = req.app.locals.io || null;
  const result = await supportService.markTicketRead(viewer, id, io);
  return successResponse(res, result, 'Ticket marked as read');
}

async function replyToTicket(req, res) {
  const viewer = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const data = replyTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;
  const io = req.app.locals.io || null;

  const result = await supportService.replyToTicket(viewer, id, data, io, kafkaProducer);
  return successResponse(res, result, 'Reply added successfully', 201);
}

async function closeTicket(req, res) {
  const viewer = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const io = req.app.locals.io || null;
  const kafkaProducer = req.app.locals.kafkaProducer;
  const ticket = await supportService.closeTicket(viewer, id, io, kafkaProducer);
  return successResponse(res, { ticket }, 'Ticket closed successfully');
}

async function rateTicket(req, res) {
  const viewer = getSupportUserContext(req);
  const { id } = idParamSchema.parse(req.params);
  const data = rateTicketSchema.parse(req.body);
  const io = req.app.locals.io || null;
  const kafkaProducer = req.app.locals.kafkaProducer;
  const ticket = await supportService.rateTicket(viewer, id, data, io, kafkaProducer);
  return successResponse(res, { ticket }, 'Ticket rated successfully');
}

async function getUnreadCount(req, res) {
  const viewer = getSupportUserContext(req);
  const unreadCount = await supportService.getUserUnreadCount(viewer);
  return successResponse(res, { unread_count: unreadCount }, 'Unread count retrieved');
}

async function adminListTickets(req, res) {
  const viewer = getSupportAdminContext(req);
  const filters = adminListTicketsSchema.parse(req.query);
  const { tickets, meta } = await supportService.adminListTickets(viewer, filters);
  return successResponse(res, { tickets }, 'Tickets retrieved', 200, meta);
}

async function adminGetTicket(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const result = await supportService.adminGetTicket(viewer, id);
  return successResponse(res, result, 'Ticket retrieved');
}

async function adminGetTicketMessages(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const filters = listMessagesSchema.parse(req.query);
  const { messages, meta } = await supportService.adminGetTicketMessages(viewer, id, filters);
  return successResponse(res, { messages }, 'Messages retrieved', 200, meta);
}

async function adminMarkTicketRead(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const io = req.app.locals.io || null;
  const result = await supportService.markTicketRead(viewer, id, io);
  return successResponse(res, result, 'Ticket marked as read');
}

async function adminReplyToTicket(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const data = replyTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;
  const io = req.app.locals.io || null;
  const result = await supportService.adminReplyToTicket(viewer, id, data, io, kafkaProducer);
  return successResponse(res, result, 'Admin reply added successfully', 201);
}

async function assignTicket(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const { admin_user_id } = assignTicketSchema.parse(req.body);
  const kafkaProducer = req.app.locals.kafkaProducer;
  const io = req.app.locals.io || null;

  const ticket = await supportService.assignTicket(
    viewer,
    id,
    admin_user_id,
    io,
    kafkaProducer
  );

  return successResponse(res, { ticket }, 'Ticket assigned successfully');
}

async function updateTicketStatus(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const { status } = updateTicketStatusSchema.parse(req.body);
  const io = req.app.locals.io || null;
  const kafkaProducer = req.app.locals.kafkaProducer;
  const ticket = await supportService.updateTicketStatus(viewer, id, status, io, kafkaProducer);
  return successResponse(res, { ticket }, 'Ticket status updated successfully');
}

async function deleteTicket(req, res) {
  const viewer = getSupportAdminContext(req);
  const { id } = idParamSchema.parse(req.params);
  const io = req.app.locals.io || null;
  const kafkaProducer = req.app.locals.kafkaProducer;
  const result = await supportService.deleteTicket(viewer, id, io, kafkaProducer);
  return successResponse(res, result, 'Ticket deleted successfully');
}

async function getAssignableAdmins(req, res) {
  getSupportAdminContext(req);
  const admins = await supportService.getAssignableAdmins();
  return successResponse(res, { admins }, 'Assignable admins retrieved');
}

async function getTicketsByUser(req, res) {
  const viewer = getSupportAdminContext(req);
  const { userId } = userIdParamSchema.parse(req.params);
  const filters = adminListTicketsSchema.parse(req.query);
  const { tickets, meta } = await supportService.getTicketsByUser(viewer, userId, filters);
  return successResponse(res, { tickets }, 'User tickets retrieved', 200, meta);
}

async function getAdminUnreadCount(req, res) {
  const viewer = getSupportAdminContext(req);
  const unreadCount = await supportService.getAdminUnreadCount(viewer);
  return successResponse(res, { unread_count: unreadCount }, 'Unread count retrieved');
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  getTicketMessages,
  markTicketRead,
  replyToTicket,
  closeTicket,
  rateTicket,
  getUnreadCount,
  adminListTickets,
  adminGetTicket,
  adminGetTicketMessages,
  adminMarkTicketRead,
  adminReplyToTicket,
  assignTicket,
  updateTicketStatus,
  deleteTicket,
  getAssignableAdmins,
  getTicketsByUser,
  getAdminUnreadCount,
};
