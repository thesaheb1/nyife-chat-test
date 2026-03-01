'use strict';

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Static routes MUST come BEFORE /:id routes
// ────────────────────────────────────────────────

// GET /unread-count -- Get unread notification count
router.get('/unread-count', asyncHandler(notificationController.getUnreadCount));

// PUT /read-all -- Mark all notifications as read
router.put('/read-all', asyncHandler(notificationController.markAllAsRead));

// POST /broadcasts -- Create an admin broadcast
router.post('/broadcasts', asyncHandler(notificationController.createBroadcast));

// GET /broadcasts -- List admin broadcasts
router.get('/broadcasts', asyncHandler(notificationController.listBroadcasts));

// ────────────────────────────────────────────────
// Root and parameterized routes
// ────────────────────────────────────────────────

// GET / -- List notifications with pagination and filters
router.get('/', asyncHandler(notificationController.listNotifications));

// PUT /:id/read -- Mark a single notification as read
router.put('/:id/read', asyncHandler(notificationController.markSingleAsRead));

// DELETE /:id -- Delete a notification
router.delete('/:id', asyncHandler(notificationController.deleteNotification));

module.exports = router;
