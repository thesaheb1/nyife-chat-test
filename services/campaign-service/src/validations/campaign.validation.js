'use strict';

const { z } = require('zod');

/**
 * Schema for creating a new campaign.
 */
const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name must be at most 255 characters'),
  description: z.string().max(5000, 'Description must be at most 5000 characters').optional(),
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID'),
  template_id: z.string().uuid('Invalid template ID'),
  type: z.enum(['immediate', 'scheduled'], {
    errorMap: () => ({ message: 'Type must be either immediate or scheduled' }),
  }).default('immediate'),
  target_type: z.enum(['group', 'contacts', 'tags', 'all'], {
    errorMap: () => ({ message: 'Target type must be one of: group, contacts, tags, all' }),
  }),
  target_config: z.object({
    group_ids: z.array(z.string().uuid()).optional(),
    contact_ids: z.array(z.string().uuid()).optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    exclude_tag_ids: z.array(z.string().uuid()).optional(),
  }).refine((config) => {
    // At least one targeting field should be present (except for 'all' which is checked in service)
    return true;
  }, { message: 'target_config must contain valid targeting criteria' }),
  variables_mapping: z.record(z.string(), z.string()).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).optional()),
});

/**
 * Schema for updating an existing campaign (all fields optional).
 */
const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID').optional(),
  template_id: z.string().uuid('Invalid template ID').optional(),
  type: z.enum(['immediate', 'scheduled']).optional(),
  target_type: z.enum(['group', 'contacts', 'tags', 'all']).optional(),
  target_config: z.object({
    group_ids: z.array(z.string().uuid()).optional(),
    contact_ids: z.array(z.string().uuid()).optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    exclude_tag_ids: z.array(z.string().uuid()).optional(),
  }).optional(),
  variables_mapping: z.record(z.string(), z.string()).optional().nullable(),
  scheduled_at: z.string().datetime({ offset: true }).optional().nullable()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).optional().nullable()),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Schema for listing campaigns with filters.
 */
const listCampaignsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled']).optional(),
  search: z.string().max(255).optional(),
  date_from: z.string().datetime({ offset: true }).optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  date_to: z.string().datetime({ offset: true }).optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

/**
 * Schema for campaign ID parameter.
 */
const campaignIdSchema = z.object({
  id: z.string().uuid('Invalid campaign ID'),
});

/**
 * Schema for listing campaign messages with filters.
 */
const listCampaignMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'queued', 'sent', 'delivered', 'read', 'failed']).optional(),
});

/**
 * Schema for retry campaign (just validates the id param).
 */
const retryCampaignSchema = z.object({
  id: z.string().uuid('Invalid campaign ID'),
});

module.exports = {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsSchema,
  campaignIdSchema,
  listCampaignMessagesSchema,
  retryCampaignSchema,
};
