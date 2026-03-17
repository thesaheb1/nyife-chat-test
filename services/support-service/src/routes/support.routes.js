'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/support.controller');
const { organizationResolver, asyncHandler, rbac } = require('@nyife/shared-middleware');

router.use(organizationResolver);

router.get('/tickets/unread-count', rbac('support', 'read'), asyncHandler(ctrl.getUnreadCount));
router.post('/tickets/:id/read', rbac('support', 'read'), asyncHandler(ctrl.markTicketRead));
router.get('/tickets/:id/messages', rbac('support', 'read'), asyncHandler(ctrl.getTicketMessages));
router.post('/tickets', rbac('support', 'create'), asyncHandler(ctrl.createTicket));
router.get('/tickets', rbac('support', 'read'), asyncHandler(ctrl.listTickets));
router.get('/tickets/:id', rbac('support', 'read'), asyncHandler(ctrl.getTicket));
router.post('/tickets/:id/reply', rbac('support', 'update'), asyncHandler(ctrl.replyToTicket));
router.put('/tickets/:id/close', rbac('support', 'update'), asyncHandler(ctrl.closeTicket));
router.put('/tickets/:id/rate', rbac('support', 'update'), asyncHandler(ctrl.rateTicket));

module.exports = router;
