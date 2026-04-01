'use strict';

const chatService = require('../services/chat.service');
const { successResponse } = require('@nyife/shared-utils');
const { resolveChatRequestContext } = require('../helpers/requestContext');
const {
  listConversationsSchema,
  conversationIdSchema,
  sendMessageSchema,
  assignConversationSchema,
  updateConversationStatusSchema,
  listMessagesSchema,
} = require('../validations/chat.validation');

function buildActor(req) {
  return {
    userId: req.user?.id || req.headers['x-user-id'],
    role: req.user?.organizationRole || req.user?.role || 'owner',
  };
}

// ────────────────────────────────────────────────
// Conversation Endpoints
// ────────────────────────────────────────────────

/**
 * GET /api/v1/chat/conversations
 * Lists conversations for the authenticated user with optional filters.
 */
async function listConversations(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const filters = listConversationsSchema.parse(req.query);

  const { conversations, meta } = await chatService.listConversations(requestContext.scopeId, actor, filters);

  return successResponse(res, { conversations }, 'Conversations retrieved', 200, meta);
}

/**
 * GET /api/v1/chat/conversations/:id
 * Gets a single conversation by ID.
 */
async function getConversation(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const { id } = conversationIdSchema.parse(req.params);

  const conversation = await chatService.getConversation(requestContext.scopeId, actor, id);

  return successResponse(res, { conversation }, 'Conversation retrieved');
}

/**
 * GET /api/v1/chat/conversations/:id/messages
 * Lists messages for a conversation with pagination.
 */
async function getConversationMessages(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const { id } = conversationIdSchema.parse(req.params);
  const filters = listMessagesSchema.parse(req.query);

  const { messages, meta } = await chatService.getConversationMessages(requestContext.scopeId, actor, id, filters);

  return successResponse(res, { messages }, 'Messages retrieved', 200, meta);
}

/**
 * POST /api/v1/chat/conversations/:id/send
 * Sends a message in a conversation.
 */
async function sendMessage(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const { id } = conversationIdSchema.parse(req.params);
  const data = sendMessageSchema.parse(req.body);

  // Access Socket.IO instance from app.locals (set in server.js)
  const io = req.app.locals.io || null;

  const message = await chatService.sendMessage(requestContext.scopeId, actor, requestContext, id, data, io);

  return successResponse(res, { message }, 'Message sent successfully', 201);
}

/**
 * POST /api/v1/chat/conversations/:id/assign
 * Assigns a conversation to a team member.
 */
async function assignConversation(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const actorUserId = actor.userId;
  const { id } = conversationIdSchema.parse(req.params);
  const { member_user_id } = assignConversationSchema.parse(req.body);

  // Access Socket.IO instance
  const io = req.app.locals.io || null;

  const conversation = await chatService.assignConversation(requestContext.scopeId, actor, id, member_user_id);

  // Emit Socket.IO event for assignment
  if (io) {
    io.to(`user:${actorUserId}`).emit('conversation:assigned', {
      conversation_id: id,
      assigned_to: member_user_id,
      assigned_by: actorUserId,
      assigned_at: conversation.assigned_at,
      assigned_member: conversation.assigned_member || null,
    });

    if (member_user_id) {
      io.to(`user:${member_user_id}`).emit('conversation:assigned', {
        conversation_id: id,
        assigned_to: member_user_id,
        assigned_by: actorUserId,
        assigned_at: conversation.assigned_at,
        assigned_member: conversation.assigned_member || null,
      });
    }

    if (conversation.assigned_to && conversation.assigned_to !== actorUserId && conversation.assigned_to !== member_user_id) {
      io.to(`user:${conversation.assigned_to}`).emit('conversation:assigned', {
        conversation_id: id,
        assigned_to: member_user_id,
        assigned_by: actorUserId,
        assigned_at: conversation.assigned_at,
        assigned_member: conversation.assigned_member || null,
      });
    }
  }

  return successResponse(res, { conversation }, 'Conversation assigned successfully');
}

/**
 * PUT /api/v1/chat/conversations/:id/status
 * Updates the status of a conversation.
 */
async function updateConversationStatus(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const { id } = conversationIdSchema.parse(req.params);
  const { status } = updateConversationStatusSchema.parse(req.body);

  // Access Socket.IO instance
  const io = req.app.locals.io || null;

  const conversation = await chatService.updateConversationStatus(requestContext.scopeId, actor, id, status);

  // Emit Socket.IO event for status change
  if (io) {
    io.to(`user:${actor.userId}`).emit('conversation:status', {
      conversation_id: id,
      status,
    });

    if (conversation.assigned_to && conversation.assigned_to !== actor.userId) {
      io.to(`user:${conversation.assigned_to}`).emit('conversation:status', {
        conversation_id: id,
        status,
      });
    }

    io.to(`conversation:${id}`).emit('conversation:status', {
      conversation_id: id,
      status,
    });
  }

  return successResponse(res, { conversation }, 'Conversation status updated');
}

/**
 * POST /api/v1/chat/conversations/:id/read
 * Marks a conversation as read (resets unread count).
 */
async function markAsRead(req, res) {
  const requestContext = resolveChatRequestContext(req);
  const actor = buildActor(req);
  const { id } = conversationIdSchema.parse(req.params);

  // Access Socket.IO instance
  const io = req.app.locals.io || null;

  const conversation = await chatService.markAsRead(requestContext.scopeId, actor, id);

  // Emit Socket.IO event for read status
  if (io) {
    io.to(`user:${actor.userId}`).emit('conversation:read', {
      conversation_id: id,
      unread_count: 0,
    });

    if (conversation.assigned_to && conversation.assigned_to !== actor.userId) {
      io.to(`user:${conversation.assigned_to}`).emit('conversation:read', {
        conversation_id: id,
        unread_count: 0,
      });
    }
  }

  return successResponse(res, { conversation }, 'Conversation marked as read');
}

module.exports = {
  listConversations,
  getConversation,
  getConversationMessages,
  sendMessage,
  assignConversation,
  updateConversationStatus,
  markAsRead,
};
