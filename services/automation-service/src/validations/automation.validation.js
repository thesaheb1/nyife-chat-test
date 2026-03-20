'use strict';

const { z } = require('zod');

/**
 * Schema for creating a new automation.
 */
const createAutomationSchema = z.object({
  name: z
    .string()
    .min(1, 'Automation name is required')
    .max(255, 'Automation name must be at most 255 characters'),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional(),
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID'),
  type: z.enum(['basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger'], {
    errorMap: () => ({
      message: 'Type must be one of: basic_reply, advanced_flow, webhook_trigger, api_trigger',
    }),
  }),
  trigger_config: z
    .object({
      trigger_type: z.string().optional(),
      trigger_value: z.string().optional(),
      match_case: z.boolean().optional(),
    })
    .passthrough(),
  action_config: z
    .object({
      message_type: z.string().optional(),
      content: z.any().optional(),
      steps: z.array(z.any()).optional(),
      webhook_url: z.string().optional(),
    })
    .passthrough(),
  priority: z.coerce.number().int().min(0).default(0),
  conditions: z
    .object({
      time_of_day: z
        .object({
          from_hour: z.number().int().min(0).max(23).optional(),
          to_hour: z.number().int().min(0).max(23).optional(),
        })
        .optional(),
    })
    .passthrough()
    .optional(),
});

/**
 * Schema for updating an existing automation (all fields optional).
 */
const updateAutomationSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    wa_account_id: z.string().uuid('Invalid WhatsApp account ID').optional(),
    type: z
      .enum(['basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger'])
      .optional(),
    trigger_config: z
      .object({
        trigger_type: z.string().optional(),
        trigger_value: z.string().optional(),
        match_case: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    action_config: z
      .object({
        message_type: z.string().optional(),
        content: z.any().optional(),
        steps: z.array(z.any()).optional(),
        webhook_url: z.string().optional(),
      })
      .passthrough()
      .optional(),
    priority: z.coerce.number().int().min(0).optional(),
    conditions: z
      .object({
        time_of_day: z
          .object({
            from_hour: z.number().int().min(0).max(23).optional(),
            to_hour: z.number().int().min(0).max(23).optional(),
          })
          .optional(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Schema for updating automation status.
 */
const updateAutomationStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'draft'], {
    errorMap: () => ({ message: 'Status must be one of: active, inactive, draft' }),
  }),
});

/**
 * Schema for listing automations with filters.
 */
const listAutomationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
  type: z
    .enum(['basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger'])
    .optional(),
  search: z.string().max(255).optional(),
  wa_account_id: z.string().uuid('Invalid WhatsApp account ID').optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

/**
 * Schema for automation ID parameter.
 */
const automationIdSchema = z.object({
  id: z.string().uuid('Invalid automation ID'),
});

/**
 * Schema for listing automation logs with pagination.
 */
const listLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Schema for creating a new webhook.
 */
const createWebhookSchema = z.object({
  name: z
    .string()
    .min(1, 'Webhook name is required')
    .max(255, 'Webhook name must be at most 255 characters'),
  url: z.string().url('Invalid webhook URL'),
  events: z
    .array(z.string().min(1))
    .min(1, 'At least one event is required'),
  secret: z.string().max(255).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

/**
 * Schema for updating an existing webhook (all fields optional).
 */
const updateWebhookSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    url: z.string().url('Invalid webhook URL').optional(),
    events: z
      .array(z.string().min(1))
      .min(1, 'At least one event is required')
      .optional(),
    secret: z.string().max(255).optional().nullable(),
    headers: z.record(z.string(), z.string()).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Schema for webhook ID parameter.
 */
const webhookIdSchema = z.object({
  id: z.string().uuid('Invalid webhook ID'),
});

module.exports = {
  createAutomationSchema,
  updateAutomationSchema,
  updateAutomationStatusSchema,
  listAutomationsSchema,
  automationIdSchema,
  listLogsSchema,
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdSchema,
};
