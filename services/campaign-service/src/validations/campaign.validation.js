'use strict';

const { z } = require('zod');

const dynamicVariableSourceSchema = z.enum(['full_name', 'email', 'phone']);
const campaignMediaTypeSchema = z.enum(['image', 'video', 'document']);

const variableBindingSchema = z.union([
  z.string(),
  z.object({
    mode: z.literal('static'),
    value: z.string(),
  }),
  z.object({
    mode: z.literal('dynamic'),
    source: dynamicVariableSourceSchema,
  }),
]);

const campaignMediaBindingSchema = z.object({
  file_id: z.string().uuid('Invalid media file ID'),
  media_type: campaignMediaTypeSchema,
  original_name: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  preview_url: z.string().url().optional().or(z.string().startsWith('/').optional()),
});

const campaignLocationBindingSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  name: z.string().trim().max(255).optional(),
  address: z.string().trim().max(500).optional(),
});

const campaignProductBindingSchema = z.object({
  product_retailer_id: z.string().trim().min(1).max(255),
});

const templateBindingsSchema = z.object({
  variables: z.record(z.string(), variableBindingSchema).optional(),
  media: z.record(z.string(), campaignMediaBindingSchema).optional(),
  locations: z.record(z.string(), campaignLocationBindingSchema).optional(),
  products: z.record(z.string(), campaignProductBindingSchema).optional(),
});

const targetConfigSchema = z.object({
  group_ids: z.array(z.string().uuid()).optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  exclude_contact_ids: z.array(z.string().uuid()).optional(),
  exclude_tag_ids: z.array(z.string().uuid()).optional(),
});

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
  target_config: targetConfigSchema,
  variables_mapping: z.record(z.string(), variableBindingSchema).optional(),
  template_bindings: templateBindingsSchema.optional(),
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
  target_config: targetConfigSchema.optional(),
  variables_mapping: z.record(z.string(), variableBindingSchema).optional().nullable(),
  template_bindings: templateBindingsSchema.optional().nullable(),
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

const executionDispatchStateSchema = z.object({
  campaignId: z.string().uuid('Invalid campaign ID'),
  campaignMessageId: z.string().uuid('Invalid campaign message ID'),
});

module.exports = {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsSchema,
  campaignIdSchema,
  listCampaignMessagesSchema,
  retryCampaignSchema,
  executionDispatchStateSchema,
};
