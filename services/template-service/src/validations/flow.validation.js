'use strict';

const { z } = require('zod');
const { FLOW_CATEGORIES, FLOW_STATUSES } = require('../constants/flow.constants');

const uuidSchema = z.string().uuid('Invalid UUID');

const createFlowSchema = z.object({
  name: z.string().min(1).max(255),
  waba_id: z.string().max(100).optional().nullable(),
  wa_account_id: uuidSchema.optional().nullable(),
  categories: z.array(z.enum(FLOW_CATEGORIES)).min(1).default(['OTHER']),
  json_version: z.string().min(1).max(20).optional(),
  json_definition: z.record(z.any()).optional(),
  editor_state: z.record(z.any()).optional().nullable(),
  data_exchange_config: z.record(z.any()).optional().nullable(),
});

const updateFlowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  waba_id: z.string().max(100).optional().nullable(),
  wa_account_id: uuidSchema.optional().nullable(),
  categories: z.array(z.enum(FLOW_CATEGORIES)).min(1).optional(),
  json_version: z.string().min(1).max(20).optional(),
  json_definition: z.record(z.any()).optional(),
  editor_state: z.record(z.any()).optional().nullable(),
  data_exchange_config: z.record(z.any()).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required.',
});

const flowIdSchema = z.object({
  id: uuidSchema,
});

const listFlowsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(FLOW_STATUSES).optional(),
  search: z.string().max(255).optional(),
  waba_id: z.string().max(100).optional(),
  category: z.enum(FLOW_CATEGORIES).optional(),
});

const flowMetaActionSchema = z.object({
  waba_id: z.string().max(100).optional(),
});

const syncFlowsSchema = z.object({
  waba_id: z.string().min(1).max(100),
  force: z.coerce.boolean().optional().default(false),
});

const listFlowSubmissionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  screen_id: z.string().max(80).optional(),
  contact_phone: z.string().max(30).optional(),
  search: z.string().max(255).optional(),
});

const submissionIdSchema = z.object({
  submissionId: uuidSchema,
});

const dataExchangeSchema = z.object({
  flow_id: uuidSchema.optional(),
  meta_flow_id: z.string().max(100).optional(),
  screen_id: z.string().max(80).optional(),
  payload: z.record(z.any()).optional(),
  data: z.record(z.any()).optional(),
  flow_token: z.string().max(255).optional(),
}).passthrough().refine((value) => value.flow_id || value.meta_flow_id, {
  message: 'flow_id or meta_flow_id is required.',
});

module.exports = {
  createFlowSchema,
  updateFlowSchema,
  flowIdSchema,
  listFlowsSchema,
  flowMetaActionSchema,
  syncFlowsSchema,
  listFlowSubmissionsSchema,
  submissionIdSchema,
  dataExchangeSchema,
};
