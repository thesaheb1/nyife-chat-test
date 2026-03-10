'use strict';

const { Op, QueryTypes } = require('sequelize');
const axios = require('axios');
const { Conversation, ChatMessage, sequelize } = require('../models');
const { AppError, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');

function normalizeInboundPayload(event) {
  if (!event || typeof event !== 'object') {
    return { message: null, contacts: [] };
  }

  if (event.event && typeof event.event === 'object') {
    return normalizeInboundPayload(event.event);
  }

  if (event.message && typeof event.message === 'object') {
    return {
      message: event.message,
      contacts: Array.isArray(event.contacts) ? event.contacts : [],
    };
  }

  return {
    message: event,
    contacts: Array.isArray(event.contacts) ? event.contacts : [],
  };
}

function normalizeStatusPayload(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  if (event.event && typeof event.event === 'object') {
    return normalizeStatusPayload(event.event);
  }

  if (event.metaMessageId && event.status) {
    return {
      id: event.metaMessageId,
      status: event.status,
      recipient_id: event.contactPhone || null,
      pricing: event.pricingCategory || event.pricingModel
        ? {
            category: event.pricingCategory || null,
            pricing_model: event.pricingModel || null,
          }
        : null,
      errors: event.errorCode || event.errorMessage
        ? [{ code: event.errorCode || null, message: event.errorMessage || null }]
        : [],
    };
  }

  if (event.status && typeof event.status === 'object') {
    return event.status;
  }

  return event;
}

async function findWaAccountById(userId, waAccountId, requireActive = false) {
  const conditions = ['id = :waAccountId', 'user_id = :userId', 'deleted_at IS NULL'];
  const replacements = { waAccountId, userId };

  if (requireActive) {
    conditions.push('status = :status');
    replacements.status = 'active';
  }

  const accounts = await sequelize.query(
    `SELECT id, user_id, waba_id, phone_number_id, display_phone, verified_name, status, onboarding_status
     FROM wa_accounts
     WHERE ${conditions.join(' AND ')}
     LIMIT 1`,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  return accounts[0] || null;
}

async function validateAssignableMember(userId, memberUserId) {
  try {
    const response = await axios.post(
      `${config.organizationServiceUrl}/api/v1/organizations/internal/team-members/validate`,
      {
        member_user_id: memberUserId,
        resource: 'chat',
        permission: 'update',
      },
      {
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return response.data?.data?.member || response.data?.data || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    throw AppError.forbidden(`Cannot assign this conversation to the selected team member. ${message}`);
  }
}

// ────────────────────────────────────────────────
// Conversation List & Detail
// ────────────────────────────────────────────────

/**
 * Lists conversations for a tenant user with optional filters and pagination.
 *
 * @param {string} userId - Tenant user ID
 * @param {object} filters - Query filters (status, assigned_to, unread, search, wa_account_id, page, limit)
 * @returns {Promise<{ conversations: Conversation[], meta: object }>}
 */
async function listConversations(userId, filters) {
  const { page, limit, status, assigned_to, unread, search, wa_account_id } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (status) {
    where.status = status;
  }

  if (assigned_to) {
    where.assigned_to = assigned_to;
  }

  if (unread === true) {
    where.unread_count = { [Op.gt]: 0 };
  }

  if (wa_account_id) {
    where.wa_account_id = wa_account_id;
  }

  if (search) {
    where[Op.or] = [
      { contact_phone: { [Op.like]: `%${search}%` } },
      { contact_name: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await Conversation.findAndCountAll({
    where,
    order: [['last_message_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return { conversations: rows, meta };
}

/**
 * Retrieves a single conversation by ID, verifying it belongs to the tenant.
 *
 * @param {string} userId - Tenant user ID
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<Conversation>}
 */
async function getConversation(userId, conversationId) {
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId },
  });

  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }

  return conversation;
}

// ────────────────────────────────────────────────
// Message History
// ────────────────────────────────────────────────

/**
 * Retrieves paginated message history for a conversation.
 * Supports infinite scroll via `before` parameter (load older messages).
 *
 * @param {string} userId - Tenant user ID
 * @param {string} conversationId - Conversation UUID
 * @param {object} filters - Query filters (page, limit, before)
 * @returns {Promise<{ messages: ChatMessage[], meta: object }>}
 */
async function getConversationMessages(userId, conversationId, filters) {
  const { page, limit, before } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  // Verify conversation belongs to this tenant
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId },
    attributes: ['id'],
  });

  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }

  const where = {
    conversation_id: conversationId,
    user_id: userId,
  };

  // For infinite scroll: load messages older than the given timestamp
  if (before) {
    where.created_at = { [Op.lt]: new Date(before) };
  }

  const { count, rows } = await ChatMessage.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return { messages: rows, meta };
}

// ────────────────────────────────────────────────
// Send Message (Outbound)
// ────────────────────────────────────────────────

/**
 * Sends an outbound message within a conversation.
 * Creates a local record, calls whatsapp-service to send via Meta API,
 * updates the message with the WhatsApp message ID, and emits Socket.IO events.
 *
 * @param {string} userId - Tenant user ID
 * @param {string} conversationId - Conversation UUID
 * @param {object} data - Message data { type, message, wa_account_id }
 * @param {object} io - Socket.IO server instance
 * @returns {Promise<ChatMessage>}
 */
async function sendMessage(userId, conversationId, data, io) {
  const { type, message, wa_account_id } = data;

  // Verify conversation belongs to user
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId },
  });

  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }

  if (String(conversation.wa_account_id) !== String(wa_account_id)) {
    throw AppError.badRequest('Messages can only be sent from the WhatsApp account bound to this conversation.');
  }

  const activeAccount = await findWaAccountById(userId, wa_account_id, true);
  if (!activeAccount) {
    throw AppError.badRequest('The WhatsApp account for this conversation is inactive and cannot send new messages.');
  }

  // Create the outbound chat message record
  const chatMessage = await ChatMessage.create({
    conversation_id: conversationId,
    user_id: userId,
    direction: 'outbound',
    sender_type: 'user',
    sender_id: userId,
    type,
    content: message,
    status: 'pending',
  });

  // Call whatsapp-service to send the message via Meta Cloud API
  let metaMessageId = null;
  try {
    const response = await axios.post(
      `${config.whatsappServiceUrl}/api/v1/whatsapp/send`,
      {
        wa_account_id,
        to: conversation.contact_phone,
        type,
        message,
      },
      {
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.data && response.data.data.message) {
      metaMessageId = response.data.data.message.meta_message_id || response.data.data.message.id || null;
    }
  } catch (err) {
    // Update message status to failed
    await chatMessage.update({ status: 'failed' });

    const errorMsg = err.response ? (err.response.data && err.response.data.message) || err.message : err.message;
    console.error(`[chat-service] Failed to send message via whatsapp-service: ${errorMsg}`);
    throw AppError.badRequest(`Failed to send message: ${errorMsg}`);
  }

  // Update the chat message with the Meta message ID and sent status
  await chatMessage.update({
    meta_message_id: metaMessageId,
    status: 'sent',
  });

  // Generate message preview for conversation
  const preview = generateMessagePreview(type, message);

  // Update conversation's last message info
  await conversation.update({
    last_message_at: new Date(),
    last_message_preview: preview,
  });

  // Reload the message to return fresh data
  await chatMessage.reload();

  // Emit Socket.IO events for real-time updates
  if (io) {
    io.to(`conversation:${conversationId}`).emit('new:message', {
      message: chatMessage.toJSON(),
    });

    io.to(`user:${userId}`).emit('conversation:updated', {
      conversation_id: conversationId,
      last_message_at: conversation.last_message_at,
      last_message_preview: preview,
      unread_count: conversation.unread_count,
    });
  }

  return chatMessage;
}

// ────────────────────────────────────────────────
// Conversation Assignment
// ────────────────────────────────────────────────

/**
 * Assigns a conversation to a team member.
 *
 * @param {string} userId - Tenant user ID (the one performing the assignment)
 * @param {string} conversationId - Conversation UUID
 * @param {string} memberUserId - Team member's user ID to assign to
 * @returns {Promise<Conversation>}
 */
async function assignConversation(userId, conversationId, memberUserId) {
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId },
  });

  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }

  await validateAssignableMember(userId, memberUserId);

  await conversation.update({
    assigned_to: memberUserId,
    assigned_at: new Date(),
    assigned_by: userId,
  });

  await conversation.reload();

  return conversation;
}

// ────────────────────────────────────────────────
// Conversation Status Update
// ────────────────────────────────────────────────

/**
 * Updates the status of a conversation (open, closed, pending).
 *
 * @param {string} userId - Tenant user ID
 * @param {string} conversationId - Conversation UUID
 * @param {string} status - New status ('open' | 'closed' | 'pending')
 * @returns {Promise<Conversation>}
 */
async function updateConversationStatus(userId, conversationId, status) {
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId },
  });

  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }

  await conversation.update({ status });
  await conversation.reload();

  return conversation;
}

// ────────────────────────────────────────────────
// Mark as Read
// ────────────────────────────────────────────────

/**
 * Marks all messages in a conversation as read by resetting unread_count to 0.
 *
 * @param {string} userId - Tenant user ID
 * @param {string} conversationId - Conversation UUID
 * @returns {Promise<Conversation>}
 */
async function markAsRead(userId, conversationId) {
  const conversation = await Conversation.findOne({
    where: { id: conversationId, user_id: userId },
  });

  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }

  await conversation.update({ unread_count: 0 });
  await conversation.reload();

  return conversation;
}

// ────────────────────────────────────────────────
// Inbound Message Handler (Kafka consumer)
// ────────────────────────────────────────────────

/**
 * Handles an inbound WhatsApp message received via the Kafka webhook.inbound topic.
 * Finds or creates a conversation, stores the message, updates conversation metadata,
 * and emits real-time Socket.IO events.
 *
 * @param {object} eventData - Kafka webhook.inbound payload { wabaId, phoneNumberId, event, eventType, timestamp }
 * @param {object} io - Socket.IO server instance
 * @returns {Promise<{ conversation: Conversation, message: ChatMessage }|null>}
 */
async function handleInboundMessage(eventData, io) {
  const phoneNumberId = eventData.phoneNumberId || eventData.phone_number_id;
  const { message: inboundMessage, contacts } = normalizeInboundPayload(eventData);

  if (!inboundMessage) {
    console.warn('[chat-service] Inbound payload is missing a message body');
    return null;
  }

  // Find the WhatsApp account by phone_number_id via raw SQL query
  // (wa_accounts table belongs to whatsapp-service but shares the same database)
  const accounts = await sequelize.query(
    'SELECT id, user_id, waba_id, phone_number_id, display_phone FROM wa_accounts WHERE phone_number_id = :phoneNumberId AND status = :status AND deleted_at IS NULL LIMIT 1',
    {
      replacements: { phoneNumberId, status: 'active' },
      type: QueryTypes.SELECT,
    }
  );

  const account = accounts[0];

  if (!account) {
    console.warn(`[chat-service] No active WA account found for phone_number_id: ${phoneNumberId}`);
    return null;
  }

  // Parse the inbound message from the webhook event
  const contactPhone = inboundMessage.from;
  const contactInfo = contacts.find((contact) => contact.wa_id === contactPhone) || null;
  const contactName = inboundMessage.profile_name || contactInfo?.profile?.name || null;
  const messageType = inboundMessage.type || 'text';
  const metaMessageId = inboundMessage.id || null;

  if (!contactPhone) {
    console.warn('[chat-service] Inbound message is missing contact phone');
    return null;
  }

  // Build message content based on type
  const content = buildInboundContent(messageType, inboundMessage);

  // Find or create the conversation for this user + WA account + contact
  const [conversation, created] = await Conversation.findOrCreate({
    where: {
      user_id: account.user_id,
      wa_account_id: account.id,
      contact_phone: contactPhone,
    },
    defaults: {
      user_id: account.user_id,
      wa_account_id: account.id,
      contact_phone: contactPhone,
      contact_name: contactName,
      status: 'open',
      last_message_at: new Date(),
      last_message_preview: generateMessagePreview(messageType, content),
      unread_count: 1,
    },
  });

  if (created) {
    console.log(`[chat-service] New conversation created for ${contactPhone} (user: ${account.user_id})`);
  }

  // Create the inbound chat message record
  const chatMessage = await ChatMessage.create({
    conversation_id: conversation.id,
    user_id: account.user_id,
    direction: 'inbound',
    sender_type: 'contact',
    sender_id: null,
    type: messageType,
    content,
    meta_message_id: metaMessageId,
    status: 'delivered',
  });

  // Generate preview for the conversation update
  const preview = generateMessagePreview(messageType, content);

  // Update conversation metadata
  const updateData = {
    last_message_at: new Date(),
    last_message_preview: preview,
    unread_count: created ? 1 : sequelize.literal('unread_count + 1'),
  };

  // Update contact_name if we got one from WhatsApp and it differs
  if (contactName && contactName !== conversation.contact_name) {
    updateData.contact_name = contactName;
  }

  // Reopen closed conversations on new inbound message
  if (conversation.status === 'closed') {
    updateData.status = 'open';
  }

  await conversation.update(updateData);
  await conversation.reload();

  // Emit Socket.IO events for real-time chat updates
  if (io) {
    // Emit new message to anyone viewing this conversation
    io.to(`conversation:${conversation.id}`).emit('new:message', {
      message: chatMessage.toJSON(),
    });

    // Emit conversation update to the user's dashboard
    io.to(`user:${account.user_id}`).emit('conversation:updated', {
      conversation_id: conversation.id,
      contact_phone: conversation.contact_phone,
      contact_name: conversation.contact_name,
      last_message_at: conversation.last_message_at,
      last_message_preview: conversation.last_message_preview,
      unread_count: conversation.unread_count,
      status: conversation.status,
      wa_account_id: conversation.wa_account_id,
    });
  }

  return { conversation, message: chatMessage };
}

// ────────────────────────────────────────────────
// Status Update Handler (Kafka consumer)
// ────────────────────────────────────────────────

/**
 * Handles a WhatsApp message status update received via the Kafka webhook.inbound topic.
 * Updates the corresponding chat message status and emits Socket.IO events.
 *
 * @param {object} eventData - Kafka webhook.inbound payload with eventType='status'
 * @param {object} io - Socket.IO server instance
 * @returns {Promise<void>}
 */
async function handleStatusUpdate(eventData, io) {
  const statusUpdate = normalizeStatusPayload(eventData);

  if (!statusUpdate) {
    console.warn('[chat-service] Status update payload is missing a status body');
    return;
  }

  const metaMessageId = statusUpdate.id;
  const newStatus = statusUpdate.status; // sent, delivered, read, failed

  if (!metaMessageId || !newStatus) {
    console.warn('[chat-service] Status update missing message ID or status');
    return;
  }

  // Only process known status values
  const validStatuses = ['sent', 'delivered', 'read', 'failed'];
  if (!validStatuses.includes(newStatus)) {
    console.warn(`[chat-service] Unknown status value: ${newStatus}`);
    return;
  }

  // Find the chat message by Meta message ID
  const chatMessage = await ChatMessage.findOne({
    where: { meta_message_id: metaMessageId },
  });

  if (!chatMessage) {
    // This can happen for campaign messages or messages not tracked in chat
    return;
  }

  // Only update if the new status is a progression (don't downgrade)
  const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
  const currentOrder = statusOrder[chatMessage.status] || 0;
  const newOrder = statusOrder[newStatus] || 0;

  // Allow 'failed' to override any status, but otherwise only progress forward
  if (newStatus !== 'failed' && newOrder <= currentOrder) {
    return;
  }

  await chatMessage.update({ status: newStatus });

  // Emit real-time status update
  if (io) {
    io.to(`conversation:${chatMessage.conversation_id}`).emit('message:status', {
      message_id: chatMessage.id,
      conversation_id: chatMessage.conversation_id,
      meta_message_id: metaMessageId,
      status: newStatus,
    });
  }
}

// ────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────

/**
 * Generates a short preview text for a message, suitable for the conversation list.
 *
 * @param {string} type - Message type (text, image, video, etc.)
 * @param {object} content - Message content payload
 * @returns {string} Preview text (max 200 chars)
 */
function generateMessagePreview(type, content) {
  if (!content) {
    return `[${type}]`;
  }

  switch (type) {
    case 'text':
      return (content.body || content.text || '').substring(0, 200);
    case 'image':
      return content.caption ? content.caption.substring(0, 200) : '[Image]';
    case 'video':
      return content.caption ? content.caption.substring(0, 200) : '[Video]';
    case 'audio':
      return '[Audio]';
    case 'document':
      return content.filename ? `[Document] ${content.filename}`.substring(0, 200) : '[Document]';
    case 'sticker':
      return '[Sticker]';
    case 'location':
      return content.name ? `[Location] ${content.name}`.substring(0, 200) : '[Location]';
    case 'contacts':
      return '[Contact]';
    case 'interactive':
      if (content.type === 'nfm_reply') {
        return '[Flow Reply]';
      }
      return content.body?.text ? content.body.text.substring(0, 200) : '[Interactive]';
    case 'template':
      return content.name ? `[Template] ${content.name}`.substring(0, 200) : '[Template]';
    case 'reaction':
      return content.emoji ? `Reacted ${content.emoji}` : '[Reaction]';
    default:
      return `[${type}]`;
  }
}

/**
 * Builds a normalized content object from an inbound WhatsApp webhook message event.
 *
 * @param {string} type - Message type from the webhook event
 * @param {object} event - The raw webhook message event
 * @returns {object} Normalized content object
 */
function buildInboundContent(type, event) {
  switch (type) {
    case 'text':
      return { body: event.text?.body || '' };
    case 'image':
      return {
        id: event.image?.id || null,
        mime_type: event.image?.mime_type || null,
        sha256: event.image?.sha256 || null,
        caption: event.image?.caption || null,
      };
    case 'video':
      return {
        id: event.video?.id || null,
        mime_type: event.video?.mime_type || null,
        sha256: event.video?.sha256 || null,
        caption: event.video?.caption || null,
      };
    case 'audio':
      return {
        id: event.audio?.id || null,
        mime_type: event.audio?.mime_type || null,
        sha256: event.audio?.sha256 || null,
        voice: event.audio?.voice || false,
      };
    case 'document':
      return {
        id: event.document?.id || null,
        mime_type: event.document?.mime_type || null,
        sha256: event.document?.sha256 || null,
        filename: event.document?.filename || null,
        caption: event.document?.caption || null,
      };
    case 'sticker':
      return {
        id: event.sticker?.id || null,
        mime_type: event.sticker?.mime_type || null,
        sha256: event.sticker?.sha256 || null,
        animated: event.sticker?.animated || false,
      };
    case 'location':
      return {
        latitude: event.location?.latitude || null,
        longitude: event.location?.longitude || null,
        name: event.location?.name || null,
        address: event.location?.address || null,
      };
    case 'contacts':
      return { contacts: event.contacts || [] };
    case 'reaction':
      return {
        message_id: event.reaction?.message_id || null,
        emoji: event.reaction?.emoji || null,
      };
    case 'interactive':
      return {
        type: event.interactive?.type || null,
        button_reply: event.interactive?.button_reply || null,
        list_reply: event.interactive?.list_reply || null,
        nfm_reply: event.interactive?.nfm_reply || null,
      };
    case 'button':
      return {
        text: event.button?.text || null,
        payload: event.button?.payload || null,
      };
    case 'order':
      return { order: event.order || {} };
    case 'referral':
      return { referral: event.referral || {} };
    default:
      // For unknown types, store the entire event payload
      return { raw: event };
  }
}

module.exports = {
  listConversations,
  getConversation,
  getConversationMessages,
  sendMessage,
  assignConversation,
  updateConversationStatus,
  markAsRead,
  handleInboundMessage,
  handleStatusUpdate,
};
