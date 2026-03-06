'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/support.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Admin support ticket routes
// Mounted at: /api/v1/admin/support
// ────────────────────────────────────────────────

// GET /tickets — List all tickets with advanced filters (admin)
router.get('/tickets', asyncHandler(ctrl.adminListTickets));

// GET /tickets/user/:userId — List all tickets for a specific user (admin)
router.get('/tickets/user/:userId', asyncHandler(ctrl.getTicketsByUser));

// GET /tickets/:id — Get a single ticket with replies and user info (admin)
router.get('/tickets/:id', asyncHandler(ctrl.adminGetTicket));

// POST /tickets/:id/reply — Add an admin reply to a ticket
router.post('/tickets/:id/reply', asyncHandler(ctrl.adminReplyToTicket));

// PUT /tickets/:id/assign — Assign a ticket to an admin
router.put('/tickets/:id/assign', asyncHandler(ctrl.assignTicket));

// PUT /tickets/:id/status — Update ticket status
router.put('/tickets/:id/status', asyncHandler(ctrl.updateTicketStatus));

module.exports = router;
