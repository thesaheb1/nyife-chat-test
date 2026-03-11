'use strict';

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { organizationResolver, asyncHandler, rbac } = require('@nyife/shared-middleware');

router.use(organizationResolver);

// ────────────────────────────────────────────────
// Conversation Routes
// All routes assume x-user-id header is set by API Gateway
// ────────────────────────────────────────────────

// GET /conversations — List conversations with filters and pagination
router.get(
  '/conversations',
  rbac('chat', 'read'),
  asyncHandler(chatController.listConversations)
);

// GET /conversations/:id — Get a single conversation
router.get(
  '/conversations/:id',
  rbac('chat', 'read'),
  asyncHandler(chatController.getConversation)
);

// GET /conversations/:id/messages — List messages for a conversation
router.get(
  '/conversations/:id/messages',
  rbac('chat', 'read'),
  asyncHandler(chatController.getConversationMessages)
);

// POST /conversations/:id/send — Send a message in a conversation
router.post(
  '/conversations/:id/send',
  rbac('chat', 'update'),
  asyncHandler(chatController.sendMessage)
);

// POST /conversations/:id/assign — Assign conversation to a team member
router.post(
  '/conversations/:id/assign',
  rbac('chat', 'update'),
  asyncHandler(chatController.assignConversation)
);

// PUT /conversations/:id/status — Update conversation status
router.put(
  '/conversations/:id/status',
  rbac('chat', 'update'),
  asyncHandler(chatController.updateConversationStatus)
);

// POST /conversations/:id/read — Mark conversation as read
router.post(
  '/conversations/:id/read',
  rbac('chat', 'update'),
  asyncHandler(chatController.markAsRead)
);

module.exports = router;
