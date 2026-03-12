'use strict';

const { Op } = require('sequelize');
const { Ticket, TicketReply, sequelize } = require('../models');
const { AppError, getPagination, getPaginationMeta, generateUUID } = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');

// ────────────────────────────────────────────────
// Helper: Ticket Number Generator
// ────────────────────────────────────────────────

/**
 * Generates a unique ticket number in format NYF-TKT-YYYYMMDD-XXXX.
 * @returns {string} Ticket number
 */
function generateTicketNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `NYF-TKT-${dateStr}-${random}`;
}

// ────────────────────────────────────────────────
// Helper: Publish notification (non-blocking)
// ────────────────────────────────────────────────

/**
 * Publishes a notification event to Kafka. Failures are logged but not thrown.
 * @param {object|null} kafkaProducer - Kafka producer instance
 * @param {string} userId - Target user ID (must be a valid UUID)
 * @param {object} notificationData - Notification payload
 */
async function sendNotification(kafkaProducer, userId, notificationData) {
  if (!kafkaProducer || !userId) return;

  try {
    await publishEvent(kafkaProducer, TOPICS.NOTIFICATION_SEND, userId, {
      userId,
      type: notificationData.type || 'in_app',
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      channel: notificationData.channel || 'support',
    });
  } catch (err) {
    console.error('[support-service] Failed to publish notification:', err.message);
  }
}

// ────────────────────────────────────────────────
// User Methods
// ────────────────────────────────────────────────

/**
 * Creates a new support ticket.
 * @param {string} userId - The ticket creator's user ID
 * @param {string} organizationId - The organization scope for the ticket
 * @param {object} data - Validated ticket data (subject, description, category, priority)
 * @param {object|null} kafkaProducer - Kafka producer for notifications
 * @returns {Promise<object>} Created ticket
 */
async function createTicket(userId, organizationId, data, kafkaProducer) {
  // Generate a unique ticket number with collision retry
  let ticketNumber;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    ticketNumber = generateTicketNumber();
    const existing = await Ticket.findOne({
      where: { ticket_number: ticketNumber },
      attributes: ['id'],
    });
    if (!existing) break;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    // Fallback: append UUID fragment for uniqueness
    ticketNumber = generateTicketNumber() + '-' + generateUUID().slice(0, 4).toUpperCase();
  }

  const ticket = await Ticket.create({
    id: generateUUID(),
    ticket_number: ticketNumber,
    user_id: userId,
    organization_id: organizationId,
    subject: data.subject,
    description: data.description,
    category: data.category,
    priority: data.priority || 'medium',
    status: 'open',
  });

  // Notify admins about the new ticket (non-blocking).
  // We use the ticket creator's userId as the notification target since
  // there is no specific admin ID to target. The notification service
  // can route based on channel='support_admin_new_ticket'.
  await sendNotification(kafkaProducer, userId, {
    type: 'in_app',
    title: 'New Support Ticket Created',
    body: `Ticket #${ticket.ticket_number}: ${data.subject}`,
    data: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, action: 'new_ticket' },
    channel: 'support_admin_new_ticket',
  });

  return ticket;
}

/**
 * Lists tickets belonging to a specific user with pagination and filters.
 * @param {string} organizationId - The organization ID
 * @param {object} filters - Query filters (page, limit, status, category)
 * @returns {Promise<{tickets: Array, meta: object}>}
 */
async function listUserTickets(organizationId, filters) {
  const { page, limit, status, category } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = { organization_id: organizationId };

  if (status) {
    where.status = status;
  }

  if (category) {
    where.category = category;
  }

  const { rows: tickets, count: total } = await Ticket.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { tickets, meta };
}

/**
 * Gets a single ticket with all its replies. Verifies the ticket belongs to the user.
 * @param {string} organizationId - The organization ID
 * @param {string} ticketId - The ticket ID
 * @returns {Promise<object>} Ticket with replies
 */
async function getTicket(organizationId, ticketId) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, organization_id: organizationId },
    include: [
      {
        model: TicketReply,
        as: 'replies',
        order: [['created_at', 'ASC']],
      },
    ],
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  return ticket;
}

/**
 * Adds a user reply to a ticket.
 * Verifies ownership and that the ticket is not closed.
 * Transitions ticket status from 'waiting_on_user' to 'open' if applicable.
 * @param {string} organizationId - The organization ID
 * @param {string} actorUserId - The acting user's ID
 * @param {string} ticketId - The ticket ID
 * @param {object} data - Reply data (body, attachments)
 * @param {object|null} kafkaProducer - Kafka producer for notifications
 * @returns {Promise<object>} Created reply
 */
async function replyToTicket(organizationId, actorUserId, ticketId, data, kafkaProducer) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, organization_id: organizationId },
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw AppError.badRequest('Cannot reply to a closed ticket');
  }

  const reply = await TicketReply.create({
    id: generateUUID(),
    ticket_id: ticketId,
    user_id: actorUserId,
    reply_type: 'user',
    body: data.body,
    attachments: data.attachments || null,
  });

  // If the ticket was waiting on user, move it back to open
  if (ticket.status === 'waiting_on_user') {
    await ticket.update({ status: 'open' });
  }

  // Notify the assigned admin if one exists
  if (ticket.assigned_to) {
    await sendNotification(kafkaProducer, ticket.assigned_to, {
      type: 'in_app',
      title: 'New Reply on Support Ticket',
      body: `User replied to ticket #${ticket.ticket_number}: ${data.body.substring(0, 100)}`,
      data: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, action: 'user_reply' },
      channel: 'support_admin_reply',
    });
  }

  return reply;
}

/**
 * Closes a ticket. Only the ticket owner can close their ticket.
 * @param {string} organizationId - The organization ID
 * @param {string} ticketId - The ticket ID
 * @returns {Promise<object>} Updated ticket
 */
async function closeTicket(organizationId, ticketId) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, organization_id: organizationId },
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw AppError.badRequest('Ticket is already closed');
  }

  await ticket.update({
    status: 'closed',
    closed_at: new Date(),
  });

  await ticket.reload();

  return ticket;
}

/**
 * Rates a resolved or closed ticket.
 * @param {string} organizationId - The organization ID
 * @param {string} ticketId - The ticket ID
 * @param {object} data - Rating data (satisfaction_rating, satisfaction_feedback)
 * @returns {Promise<object>} Updated ticket
 */
async function rateTicket(organizationId, ticketId, data) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId, organization_id: organizationId },
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw AppError.badRequest('Ticket can only be rated after it has been resolved or closed');
  }

  if (ticket.satisfaction_rating !== null) {
    throw AppError.badRequest('Ticket has already been rated');
  }

  await ticket.update({
    satisfaction_rating: data.satisfaction_rating,
    satisfaction_feedback: data.satisfaction_feedback || null,
  });

  await ticket.reload();

  return ticket;
}

// ────────────────────────────────────────────────
// Admin Methods
// ────────────────────────────────────────────────

/**
 * Lists all tickets with advanced filtering, search, and pagination (admin).
 * @param {object} filters - Advanced filter options
 * @returns {Promise<{tickets: Array, meta: object}>}
 */
async function adminListTickets(filters) {
  const { page, limit, status, priority, category, assigned_to, user_id, search, date_from, date_to } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = {};

  if (status) {
    where.status = status;
  }

  if (priority) {
    where.priority = priority;
  }

  if (category) {
    where.category = category;
  }

  if (assigned_to) {
    where.assigned_to = assigned_to;
  }

  if (user_id) {
    where.user_id = user_id;
  }

  if (search) {
    where[Op.or] = [
      { subject: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { ticket_number: { [Op.like]: `%${search}%` } },
    ];
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      where.created_at[Op.lte] = new Date(date_to);
    }
  }

  const { rows: tickets, count: total } = await Ticket.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [
      // Urgent tickets first, then by most recent
      [sequelize.literal("FIELD(priority, 'urgent', 'high', 'medium', 'low')"), 'ASC'],
      ['created_at', 'DESC'],
    ],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { tickets, meta };
}

/**
 * Gets a single ticket with all replies and the ticket creator's user info (admin).
 * Fetches user info via raw SQL on auth_users (cross-service table).
 * @param {string} ticketId - The ticket ID
 * @returns {Promise<object>} Ticket with replies and user info
 */
async function adminGetTicket(ticketId) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId },
    include: [
      {
        model: TicketReply,
        as: 'replies',
        separate: true,
        order: [['created_at', 'ASC']],
      },
    ],
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  // Fetch user info from auth_users table (cross-service query)
  let userInfo = null;
  try {
    const [users] = await sequelize.query(
      'SELECT id, first_name, last_name, email, phone FROM auth_users WHERE id = ? LIMIT 1',
      {
        replacements: [ticket.user_id],
        type: sequelize.constructor.QueryTypes.SELECT,
      }
    );
    userInfo = users || null;
  } catch (err) {
    // auth_users table may not exist in test environments or isolated setups
    console.warn('[support-service] Could not fetch user info from auth_users:', err.message);
    userInfo = null;
  }

  const ticketData = ticket.toJSON();
  ticketData.user = userInfo;

  return ticketData;
}

/**
 * Adds an admin reply to a ticket and optionally transitions status to 'waiting_on_user'.
 * @param {string} adminUserId - The admin user's ID
 * @param {string} ticketId - The ticket ID
 * @param {object} data - Reply data (body, attachments)
 * @param {object|null} kafkaProducer - Kafka producer for notifications
 * @returns {Promise<object>} Created reply
 */
async function adminReplyToTicket(adminUserId, ticketId, data, kafkaProducer) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw AppError.badRequest('Cannot reply to a closed ticket');
  }

  const reply = await TicketReply.create({
    id: generateUUID(),
    ticket_id: ticketId,
    user_id: adminUserId,
    reply_type: 'admin',
    body: data.body,
    attachments: data.attachments || null,
  });

  // Transition status to 'waiting_on_user' if ticket was open or in_progress
  if (ticket.status === 'open' || ticket.status === 'in_progress') {
    await ticket.update({ status: 'waiting_on_user' });
  }

  // If the ticket is not yet assigned to anyone, auto-assign to the replying admin
  if (!ticket.assigned_to) {
    await ticket.update({
      assigned_to: adminUserId,
      assigned_at: new Date(),
    });
  }

  // Notify the ticket owner about the admin reply
  await sendNotification(kafkaProducer, ticket.user_id, {
    type: 'in_app',
    title: 'Support Team Replied',
    body: `New reply on ticket #${ticket.ticket_number}: ${data.body.substring(0, 100)}`,
    data: { ticketId: ticket.id, ticketNumber: ticket.ticket_number, action: 'admin_reply' },
    channel: 'support_user_reply',
  });

  return reply;
}

/**
 * Assigns a ticket to an admin user.
 * @param {string} ticketId - The ticket ID
 * @param {string} adminUserId - The admin user ID to assign
 * @returns {Promise<object>} Updated ticket
 */
async function assignTicket(ticketId, adminUserId) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (ticket.status === 'closed') {
    throw AppError.badRequest('Cannot assign a closed ticket');
  }

  await ticket.update({
    assigned_to: adminUserId,
    assigned_at: new Date(),
  });

  // If the ticket is still open, move to in_progress when assigned
  if (ticket.status === 'open') {
    await ticket.update({ status: 'in_progress' });
  }

  await ticket.reload();

  return ticket;
}

/**
 * Updates a ticket's status. Sets resolved_at or closed_at timestamps as appropriate.
 * @param {string} ticketId - The ticket ID
 * @param {string} status - The new status
 * @returns {Promise<object>} Updated ticket
 */
async function updateTicketStatus(ticketId, status) {
  const ticket = await Ticket.findOne({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  const updateData = { status };

  if (status === 'resolved') {
    updateData.resolved_at = new Date();
  }

  if (status === 'closed') {
    updateData.closed_at = new Date();
  }

  await ticket.update(updateData);
  await ticket.reload();

  return ticket;
}

/**
 * Lists all tickets for a specific user (admin view).
 * @param {string} userId - The target user's ID
 * @param {object} filters - Pagination filters (page, limit)
 * @returns {Promise<{tickets: Array, meta: object}>}
 */
async function getTicketsByUser(userId, filters) {
  const { page, limit, organization_id } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);
  const where = { user_id: userId };

  if (organization_id) {
    where.organization_id = organization_id;
  }

  const { rows: tickets, count: total } = await Ticket.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { tickets, meta };
}

module.exports = {
  createTicket,
  listUserTickets,
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
