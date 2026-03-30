'use strict';

const { z } = require('zod');

// E.164 phone format: starts with +, followed by 7-15 digits
const e164Regex = /^\+[1-9]\d{6,14}$/;

const createContactSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(e164Regex, 'Phone must be in E.164 format (e.g., +919876543210)'),
  name: z.string().max(200).optional(),
  email: z.string().email('Invalid email format').max(255).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  custom_fields: z.record(z.any()).optional(),
  tag_ids: z.array(z.string().uuid('Invalid tag ID')).optional(),
});

const updateContactSchema = z.object({
  phone: z
    .string()
    .regex(e164Regex, 'Phone must be in E.164 format (e.g., +919876543210)')
    .optional(),
  name: z.string().max(200).nullable().optional(),
  email: z.string().email('Invalid email format').max(255).nullable().optional(),
  company: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  custom_fields: z.record(z.any()).nullable().optional(),
  whatsapp_name: z.string().max(200).nullable().optional(),
  opted_in: z.boolean().optional(),
});

const listContactsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  ids: z.string().max(5000).optional(),
  tag_id: z.string().uuid('Invalid tag ID').optional(),
  tag_ids: z.string().max(5000).optional(),
  group_id: z.string().uuid('Invalid group ID').optional(),
  opted_in: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  source: z.enum(['manual', 'csv_import', 'whatsapp_incoming', 'api']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

const bulkDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required')
    .max(500, 'Cannot bulk delete more than 500 contacts at once'),
});

const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(100, 'Tag name must be at most 100 characters'),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color (e.g., #3B82F6)')
    .optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Color must be a valid hex color (e.g., #3B82F6)')
    .optional(),
});

const addTagsSchema = z.object({
  tag_ids: z
    .array(z.string().uuid('Invalid tag ID'))
    .min(1, 'At least one tag ID is required'),
});

const addTagByPhoneSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(e164Regex, 'Phone must be in E.164 format (e.g., +919876543210)'),
  tag_id: z.string().uuid('Invalid tag ID'),
});

const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Group name is required')
    .max(200, 'Group name must be at most 200 characters'),
  description: z.string().max(2000).optional(),
  type: z.enum(['static', 'dynamic']).default('static').optional(),
  dynamic_filters: z.record(z.any()).optional(),
  contact_ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .max(500, 'Cannot assign more than 500 contacts while creating a group')
    .optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  dynamic_filters: z.record(z.any()).nullable().optional(),
});

const addGroupMembersSchema = z.object({
  contact_ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required'),
});

const removeGroupMembersSchema = z.object({
  contact_ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required'),
});

const listGroupsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  ids: z.string().max(5000).optional(),
  type: z.enum(['static', 'dynamic']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

const listTagsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().max(200).optional(),
  ids: z.string().max(5000).optional(),
});

const bulkGroupMembershipSchema = z.object({
  group_ids: z
    .array(z.string().uuid('Invalid group ID'))
    .min(1, 'At least one group ID is required')
    .max(100, 'Cannot update more than 100 groups at once'),
  contact_ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required')
    .max(500, 'Cannot update more than 500 contacts at once'),
});

const bulkTagAssignmentSchema = z.object({
  tag_ids: z
    .array(z.string().uuid('Invalid tag ID'))
    .min(1, 'At least one tag ID is required')
    .max(100, 'Cannot update more than 100 tags at once'),
  contact_ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required')
    .max(500, 'Cannot update more than 500 contacts at once'),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

const tagIdParamSchema = z.object({
  id: z.string().uuid('Invalid contact ID format'),
  tagId: z.string().uuid('Invalid tag ID format'),
});

const groupIdParamSchema = z.object({
  id: z.string().uuid('Invalid group ID format'),
});

const groupMembersListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  createContactSchema,
  updateContactSchema,
  listContactsSchema,
  bulkDeleteSchema,
  createTagSchema,
  listTagsSchema,
  updateTagSchema,
  addTagsSchema,
  addTagByPhoneSchema,
  createGroupSchema,
  updateGroupSchema,
  addGroupMembersSchema,
  removeGroupMembersSchema,
  listGroupsSchema,
  bulkGroupMembershipSchema,
  bulkTagAssignmentSchema,
  idParamSchema,
  tagIdParamSchema,
  groupIdParamSchema,
  groupMembersListSchema,
};
