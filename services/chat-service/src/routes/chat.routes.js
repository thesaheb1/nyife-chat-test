'use strict';

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Conversation Routes
// All routes assume x-user-id header is set by API Gateway
// ────────────────────────────────────────────────

// GET /conversations — List conversations with filters and pagination
router.get(
  '/conversations',
  asyncHandler(chatController.listConversations)
);

// GET /conversations/:id — Get a single conversation
router.get(
  '/conversations/:id',
  asyncHandler(chatController.getConversation)
);

// GET /conversations/:id/messages — List messages for a conversation
router.get(
  '/conversations/:id/messages',
  asyncHandler(chatController.getConversationMessages)
);

// POST /conversations/:id/send — Send a message in a conversation
router.post(
  '/conversations/:id/send',
  asyncHandler(chatController.sendMessage)
);

// POST /conversations/:id/assign — Assign conversation to a team member
router.post(
  '/conversations/:id/assign',
  asyncHandler(chatController.assignConversation)
);

// PUT /conversations/:id/status — Update conversation status
router.put(
  '/conversations/:id/status',
  asyncHandler(chatController.updateConversationStatus)
);

// POST /conversations/:id/read — Mark conversation as read
router.post(
  '/conversations/:id/read',
  asyncHandler(chatController.markAsRead)
);

module.exports = router;
