'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/support.controller');
const { asyncHandler, adminRbac } = require('@nyife/shared-middleware');

router.get('/tickets/unread-count', adminRbac('support', 'read'), asyncHandler(ctrl.getAdminUnreadCount));
router.get('/tickets/assignable-admins', adminRbac('support', 'read'), asyncHandler(ctrl.getAssignableAdmins));
router.get('/tickets/user/:userId', adminRbac('support', 'read'), asyncHandler(ctrl.getTicketsByUser));
router.post('/tickets/:id/read', adminRbac('support', 'read'), asyncHandler(ctrl.adminMarkTicketRead));
router.get('/tickets/:id/messages', adminRbac('support', 'read'), asyncHandler(ctrl.adminGetTicketMessages));
router.get('/tickets', adminRbac('support', 'read'), asyncHandler(ctrl.adminListTickets));
router.get('/tickets/:id', adminRbac('support', 'read'), asyncHandler(ctrl.adminGetTicket));
router.post('/tickets/:id/reply', adminRbac('support', 'update'), asyncHandler(ctrl.adminReplyToTicket));
router.put('/tickets/:id/assign', adminRbac('support', 'update'), asyncHandler(ctrl.assignTicket));
router.put('/tickets/:id/status', adminRbac('support', 'update'), asyncHandler(ctrl.updateTicketStatus));
router.delete('/tickets/:id', adminRbac('support', 'delete'), asyncHandler(ctrl.deleteTicket));

module.exports = router;