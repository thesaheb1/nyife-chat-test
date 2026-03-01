'use strict';

const { z } = require('zod');

/**
 * Schema for listing notifications with pagination and filters.
 */
const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(['general', 'support', 'subscription', 'campaign', 'system', 'promotion']).optional(),
  is_read: z
    .preprocess((val) => {
      if (val === 'true' || val === '1') return true;
      if (val === 'false' || val === '0') return false;
      return val;
    }, z.boolean().optional())
    .optional(),
});

/**
 * Schema for marking specific notifications as read (batch).
 */
const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).min(1, 'At least one notification ID is required'),
});

/**
 * Schema for notification ID parameter validation.
 */
const notificationIdSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

/**
 * Schema for single notification mark-read parameter validation.
 */
const singleMarkReadSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

/**
 * Schema for creating an admin broadcast.
 */
const createBroadcastSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be at most 500 characters'),
  body: z.string().min(1, 'Body is required'),
  target_type: z.enum(['all', 'specific_users']).default('all'),
  target_user_ids: z.array(z.string().uuid()).optional(),
});

module.exports = {
  listNotificationsSchema,
  markReadSchema,
  notificationIdSchema,
  singleMarkReadSchema,
  createBroadcastSchema,
};
