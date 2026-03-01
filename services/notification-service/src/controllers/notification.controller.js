'use strict';

const notificationService = require('../services/notification.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  listNotificationsSchema,
  markReadSchema,
  notificationIdSchema,
  singleMarkReadSchema,
  createBroadcastSchema,
} = require('../validations/notification.validation');

// ────────────────────────────────────────────────
// User Notification Endpoints
// ────────────────────────────────────────────────

/**
 * GET /api/v1/notifications
 * Lists notifications for the authenticated user with pagination and filters.
 */
async function listNotifications(req, res) {
  const userId = req.headers['x-user-id'];
  const filters = listNotificationsSchema.parse(req.query);

  const { notifications, meta } = await notificationService.listNotifications(userId, filters);

  return successResponse(res, { notifications }, 'Notifications retrieved', 200, meta);
}

/**
 * GET /api/v1/notifications/unread-count
 * Gets the number of unread notifications for the authenticated user.
 */
async function getUnreadCount(req, res) {
  const userId = req.headers['x-user-id'];

  const count = await notificationService.getUnreadCount(userId);

  return successResponse(res, { unread_count: count }, 'Unread count retrieved');
}

/**
 * PUT /api/v1/notifications/:id/read
 * Marks a single notification as read.
 */
async function markSingleAsRead(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = singleMarkReadSchema.parse(req.params);

  const result = await notificationService.markSingleAsRead(userId, id);

  return successResponse(res, result, 'Notification marked as read');
}

/**
 * PUT /api/v1/notifications/read-all
 * Marks all unread notifications as read for the authenticated user.
 */
async function markAllAsRead(req, res) {
  const userId = req.headers['x-user-id'];

  const result = await notificationService.markAllAsRead(userId);

  return successResponse(res, result, 'All notifications marked as read');
}

/**
 * DELETE /api/v1/notifications/:id
 * Hard-deletes a notification for the authenticated user.
 */
async function deleteNotification(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = notificationIdSchema.parse(req.params);

  const result = await notificationService.deleteNotification(userId, id);

  return successResponse(res, result, 'Notification deleted successfully');
}

// ────────────────────────────────────────────────
// Admin Broadcast Endpoints
// ────────────────────────────────────────────────

/**
 * POST /api/v1/notifications/broadcasts
 * Creates an admin broadcast and delivers notifications to target users.
 */
async function createBroadcast(req, res) {
  const adminId = req.headers['x-user-id'];
  const data = createBroadcastSchema.parse(req.body);

  const broadcast = await notificationService.createBroadcast(adminId, data);

  return successResponse(res, { broadcast }, 'Broadcast created successfully', 201);
}

/**
 * GET /api/v1/notifications/broadcasts
 * Lists admin broadcasts with pagination.
 */
async function listBroadcasts(req, res) {
  const filters = listNotificationsSchema.parse(req.query);

  const { broadcasts, meta } = await notificationService.listBroadcasts(filters);

  return successResponse(res, { broadcasts }, 'Broadcasts retrieved', 200, meta);
}

module.exports = {
  listNotifications,
  getUnreadCount,
  markSingleAsRead,
  markAllAsRead,
  deleteNotification,
  createBroadcast,
  listBroadcasts,
};
