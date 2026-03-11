'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/support.controller');
const { organizationResolver, asyncHandler, rbac } = require('@nyife/shared-middleware');

router.use(organizationResolver);

// ────────────────────────────────────────────────
// User support ticket routes
// Mounted at: /api/v1/support
// ────────────────────────────────────────────────

// POST /tickets — Create a new support ticket
router.post('/tickets', rbac('support', 'create'), asyncHandler(ctrl.createTicket));

// GET /tickets — List user's tickets with pagination and filters
router.get('/tickets', rbac('support', 'read'), asyncHandler(ctrl.listTickets));

// GET /tickets/:id — Get a single ticket with replies
router.get('/tickets/:id', rbac('support', 'read'), asyncHandler(ctrl.getTicket));

// POST /tickets/:id/reply — Add a user reply to a ticket
router.post('/tickets/:id/reply', rbac('support', 'update'), asyncHandler(ctrl.replyToTicket));

// PUT /tickets/:id/close — Close a ticket
router.put('/tickets/:id/close', rbac('support', 'update'), asyncHandler(ctrl.closeTicket));

// PUT /tickets/:id/rate — Rate a resolved/closed ticket
router.put('/tickets/:id/rate', rbac('support', 'update'), asyncHandler(ctrl.rateTicket));

module.exports = router;
