'use strict';

const { Op } = require('sequelize');
const { Notification, AdminBroadcast, sequelize } = require('../models');
const { AppError, getPagination, getPaginationMeta, generateUUID } = require('@nyife/shared-utils');

// Module-level reference to the Express app for accessing io via app.locals
let _app = null;

/**
 * Sets the Express app reference so the service can access app.locals.io
 * for emitting Socket.IO events.
 *
 * @param {import('express').Application} app - The Express app instance
 */
function setApp(app) {
  _app = app;
}

/**
 * Gets the Socket.IO server instance from the app locals.
 *
 * @returns {import('socket.io').Server|null}
 */
function getIO() {
  return _app && _app.locals ? _app.locals.io : null;
}

// ────────────────────────────────────────────────
// Notification CRUD
// ────────────────────────────────────────────────

/**
 * Creates a new notification record and emits a real-time event via Socket.IO.
 *
 * @param {string} userId - Recipient user ID
 * @param {object} data - Notification data
 * @param {string} data.type - Notification type (info, warning, success, error, action)
 * @param {string} data.title - Notification title
 * @param {string} data.body - Notification body
 * @param {object} [data.meta] - Optional metadata
 * @param {string} [data.category] - Notification category (general, support, subscription, campaign, system, promotion)
 * @param {string} [data.sender_type] - Sender type (system, admin)
 * @param {string} [data.action_url] - Link to relevant page
 * @returns {Promise<object>} The created notification record
 */
async function createNotification(userId, data) {
  const notification = await Notification.create({
    id: generateUUID(),
    user_id: userId,
    type: data.type || 'info',
    title: data.title,
    body: data.body,
    meta: data.meta || null,
    category: data.category || 'general',
    sender_type: data.sender_type || 'system',
    action_url: data.action_url || null,
    is_read: false,
  });

  // Emit real-time notification via Socket.IO (using /notifications namespace)
  const io = getIO();
  if (io) {
    io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  }

  return notification;
}

/**
 * Lists notifications for a user with pagination and filters.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {object} filters - Query filters (page, limit, category, is_read)
 * @returns {Promise<{notifications: Array, meta: object}>}
 */
async function listNotifications(userId, filters) {
  const { page, limit, category, is_read } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (category) {
    where.category = category;
  }

  if (is_read !== undefined && is_read !== null) {
    where.is_read = is_read;
  }

  const { rows: notifications, count: total } = await Notification.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { notifications, meta };
}

/**
 * Marks a single notification as read for a user.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} notificationId - The notification ID to mark as read
 * @returns {Promise<{updated: number}>} Number of notifications marked as read
 */
async function markSingleAsRead(userId, notificationId) {
  const [updatedCount] = await Notification.update(
    {
      is_read: true,
      read_at: new Date(),
    },
    {
      where: {
        id: notificationId,
        user_id: userId,
        is_read: false,
      },
    }
  );

  return { updated: updatedCount };
}

/**
 * Marks specific notifications as read for a user.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string[]} notificationIds - Array of notification IDs to mark as read
 * @returns {Promise<{updated: number}>} Number of notifications marked as read
 */
async function markAsRead(userId, notificationIds) {
  const [updatedCount] = await Notification.update(
    {
      is_read: true,
      read_at: new Date(),
    },
    {
      where: {
        id: { [Op.in]: notificationIds },
        user_id: userId,
        is_read: false,
      },
    }
  );

  return { updated: updatedCount };
}

/**
 * Marks all unread notifications as read for a user.
 *
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<{updated: number}>} Number of notifications marked as read
 */
async function markAllAsRead(userId) {
  const [updatedCount] = await Notification.update(
    {
      is_read: true,
      read_at: new Date(),
    },
    {
      where: {
        user_id: userId,
        is_read: false,
      },
    }
  );

  return { updated: updatedCount };
}

/**
 * Hard-deletes a notification for a user.
 *
 * @param {string} userId - The authenticated user's ID
 * @param {string} id - The notification ID to delete
 * @returns {Promise<{id: string}>} The deleted notification's ID
 */
async function deleteNotification(userId, id) {
  const notification = await Notification.findOne({
    where: { id, user_id: userId },
  });

  if (!notification) {
    throw AppError.notFound('Notification not found');
  }

  await notification.destroy();

  return { id };
}

/**
 * Gets the count of unread notifications for a user.
 *
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<number>} Unread notification count
 */
async function getUnreadCount(userId) {
  const count = await Notification.count({
    where: {
      user_id: userId,
      is_read: false,
    },
  });

  return count;
}

// ────────────────────────────────────────────────
// Admin Broadcasts
// ────────────────────────────────────────────────

/**
 * Creates an admin broadcast and generates individual notification records
 * for all target users matching the target_type criteria.
 * If target_type is 'all', queries auth_users via raw SQL to resolve user IDs.
 * If target_type is 'specific_users', uses target_user_ids directly.
 * Bulk creates notifications and emits Socket.IO events to each user.
 *
 * @param {string} adminId - The admin user's ID
 * @param {object} data - Broadcast data
 * @param {string} data.title - Broadcast title
 * @param {string} data.body - Broadcast body
 * @param {string} [data.target_type='all'] - Target type filter
 * @param {string[]} [data.target_user_ids] - Specific user IDs when target_type is 'specific_users'
 * @returns {Promise<object>} The created broadcast record
 */
async function createBroadcast(adminId, data) {
  const { title, body, target_type, target_user_ids } = data;

  // Create the broadcast record
  const broadcast = await AdminBroadcast.create({
    id: generateUUID(),
    admin_id: adminId,
    title,
    body,
    target_type: target_type || 'all',
    target_user_ids: target_user_ids || null,
    sent_count: 0,
  });

  // Resolve target user IDs
  let userIds = [];

  if (target_type === 'specific_users' && Array.isArray(target_user_ids) && target_user_ids.length > 0) {
    // Use the provided user IDs directly
    userIds = target_user_ids;
  } else {
    // Query all non-deleted users from auth_users
    const userQuery = 'SELECT id FROM auth_users WHERE deleted_at IS NULL';

    try {
      const [rows] = await sequelize.query(userQuery, {
        raw: true,
      });
      // sequelize.query returns [rows, metadata] for raw queries
      if (Array.isArray(rows)) {
        userIds = rows.map((row) => row.id).filter(Boolean);
      }
    } catch (err) {
      // If the auth_users table doesn't exist (e.g., in dev), handle gracefully
      console.error('[notification-service] Failed to query auth_users for broadcast:', err.message);
      userIds = [];
    }
  }

  if (userIds.length > 0) {
    // Bulk create notification records in batches of 500
    const batchSize = 500;
    const io = getIO();

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const notificationRecords = batch.map((uid) => ({
        id: generateUUID(),
        user_id: uid,
        type: 'info',
        title,
        body,
        meta: null,
        category: 'system',
        sender_type: 'admin',
        action_url: null,
        is_read: false,
      }));

      await Notification.bulkCreate(notificationRecords);

      // Emit Socket.IO events to each user in this batch (using /notifications namespace)
      if (io) {
        batch.forEach((uid) => {
          io.of('/notifications').to(`user:${uid}`).emit('notification:new', {
            title,
            body,
            category: 'system',
            type: 'info',
            sender_type: 'admin',
            is_read: false,
            meta: null,
          });
        });
      }
    }

    // Update sent_count on the broadcast record
    await broadcast.update({ sent_count: userIds.length });
    await broadcast.reload();
  }

  return broadcast;
}

/**
 * Lists admin broadcasts with pagination.
 *
 * @param {object} filters - Query filters (page, limit)
 * @returns {Promise<{broadcasts: Array, meta: object}>}
 */
async function listBroadcasts(filters) {
  const { page, limit } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const { rows: broadcasts, count: total } = await AdminBroadcast.findAndCountAll({
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { broadcasts, meta };
}

module.exports = {
  setApp,
  createNotification,
  listNotifications,
  markSingleAsRead,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  createBroadcast,
  listBroadcasts,
};
