'use strict';

const { z } = require('zod');

/**
 * Query schema for user dashboard endpoint.
 * Accepts optional date range filters.
 */
const dashboardQuerySchema = z.object({
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format')
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format')
    .optional(),
});

/**
 * Query schema for admin dashboard endpoint.
 * Extends user dashboard with optional user_id for filtering by specific tenant.
 */
const adminDashboardQuerySchema = z.object({
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format')
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format')
    .optional(),
  user_id: z.string().uuid().optional(),
});

/**
 * Query schema for the metrics endpoint.
 * Requires at least one metric name and a date range.
 */
const metricsQuerySchema = z.object({
  metrics: z
    .string()
    .transform((val) => val.split(',').map((m) => m.trim()))
    .pipe(z.array(z.string().min(1)).min(1)),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format'),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format'),
  user_id: z.string().uuid().optional(),
});

module.exports = {
  dashboardQuerySchema,
  adminDashboardQuerySchema,
  metricsQuerySchema,
};
