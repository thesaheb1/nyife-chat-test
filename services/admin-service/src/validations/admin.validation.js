'use strict';

const { z } = require('zod');
const { ADMIN_ASSIGNABLE_RESOURCE_KEYS } = require('@nyife/shared-utils');

const resourcePermissionSchema = z.object({
  create: z.boolean().optional(),
  read: z.boolean().optional(),
  update: z.boolean().optional(),
  delete: z.boolean().optional(),
});

const adminPermissionResourceShape = ADMIN_ASSIGNABLE_RESOURCE_KEYS.reduce((accumulator, resource) => {
  accumulator[resource] = resourcePermissionSchema.optional();
  return accumulator;
}, {});

const adminPermissionsSchema = z.object({
  resources: z.object(adminPermissionResourceShape).strict(),
});

// ---------------------------------------------------------------------------
// Sub-admin schemas
// ---------------------------------------------------------------------------

const createSubAdminSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10).max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role_id: z.string().uuid('Invalid role ID'),
});

const inviteSubAdminSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  role_id: z.string().uuid('Invalid role ID'),
});

const updateSubAdminSchema = z
  .object({
    role_id: z.string().uuid('Invalid role ID').optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// ---------------------------------------------------------------------------
// User management schemas
// ---------------------------------------------------------------------------

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  plan: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const createUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10).max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['user', 'admin']).default('user'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

const walletActionSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
  remarks: z.string().min(1, 'Remarks are required').max(500),
  organization_id: z.string().uuid('Invalid organization ID').optional(),
});

// ---------------------------------------------------------------------------
// Plan schemas
// ---------------------------------------------------------------------------

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  slug: z
    .string()
    .min(1, 'Plan slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Plan slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  type: z.enum(['monthly', 'yearly', 'lifetime']),
  price: z.number().int().min(0),
  currency: z.string().length(3).default('INR'),
  max_contacts: z.number().int().min(0).default(0),
  max_templates: z.number().int().min(0).default(0),
  max_campaigns_per_month: z.number().int().min(0).default(0),
  max_messages_per_month: z.number().int().min(0).default(0),
  max_team_members: z.number().int().min(0).default(0),
  max_organizations: z.number().int().min(0).default(1),
  max_whatsapp_numbers: z.number().int().min(0).default(1),
  has_priority_support: z.boolean().default(false),
  marketing_message_price: z.number().int().min(0).default(0),
  utility_message_price: z.number().int().min(0).default(0),
  auth_message_price: z.number().int().min(0).default(0),
  features: z.record(z.any()).optional(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

const updatePlanSchema = createPlanSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const planStatusSchema = z.object({
  is_active: z.boolean(),
});

// ---------------------------------------------------------------------------
// Coupon schemas
// ---------------------------------------------------------------------------

const createCouponSchema = z.object({
  code: z
    .string()
    .min(1, 'Coupon code is required')
    .max(50)
    .transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().int().positive('Discount value must be positive'),
  max_uses: z.number().int().positive().optional(),
  min_plan_price: z.number().int().min(0).optional(),
  applicable_plan_ids: z.array(z.string().uuid()).optional(),
  applicable_user_ids: z.array(z.string().uuid()).optional(),
  valid_from: z.string(),
  valid_until: z.string().optional(),
  is_active: z.boolean().default(true),
});

const updateCouponSchema = createCouponSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// ---------------------------------------------------------------------------
// Notification schemas
// ---------------------------------------------------------------------------

const createNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  body: z.string().min(1, 'Body is required'),
  target_type: z.enum(['all', 'specific_users']),
  target_user_ids: z.array(z.string().uuid()).optional(),
  send_email: z.boolean().default(false),
});

const sendAdminEmailSchema = z.object({
  type: z.enum(['transactional', 'marketing', 'admin_broadcast']).default('transactional'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
});

// ---------------------------------------------------------------------------
// Settings schemas
// ---------------------------------------------------------------------------

const updateSettingsSchema = z.object({}).passthrough();

// ---------------------------------------------------------------------------
// Role schemas
// ---------------------------------------------------------------------------

const createRoleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  permissions: adminPermissionsSchema,
});

const updateRoleSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    permissions: adminPermissionsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// ---------------------------------------------------------------------------
// Common schemas
// ---------------------------------------------------------------------------

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const validateAdminInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

const acceptAdminInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8).max(128).optional(),
});

module.exports = {
  createSubAdminSchema,
  inviteSubAdminSchema,
  updateSubAdminSchema,
  listUsersSchema,
  createUserSchema,
  updateUserStatusSchema,
  walletActionSchema,
  createPlanSchema,
  updatePlanSchema,
  planStatusSchema,
  createCouponSchema,
  updateCouponSchema,
  createNotificationSchema,
  sendAdminEmailSchema,
  updateSettingsSchema,
  createRoleSchema,
  updateRoleSchema,
  idParamSchema,
  paginationSchema,
  validateAdminInvitationSchema,
  acceptAdminInvitationSchema,
};
