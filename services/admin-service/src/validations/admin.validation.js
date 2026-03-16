'use strict';

const { z } = require('zod');
const { ADMIN_ASSIGNABLE_RESOURCE_KEYS, isValidRupeeAmount } = require('@nyife/shared-utils');

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

function positiveRupeeAmountSchema(label) {
  return z
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a valid number`)
    .positive(`${label} must be greater than 0`)
    .refine((value) => isValidRupeeAmount(value, { allowZero: false }), {
      message: `${label} can have at most 2 decimal places`,
    });
}

function nonNegativeRupeeAmountSchema(label) {
  return z
    .number({ invalid_type_error: `${label} must be a number` })
    .finite(`${label} must be a valid number`)
    .min(0, `${label} must be 0 or more`)
    .refine((value) => isValidRupeeAmount(value, { allowZero: true }), {
      message: `${label} can have at most 2 decimal places`,
    });
}

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
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
});

const inviteUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10).max(20).optional(),
});

const updateUserSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required').max(100).optional(),
    last_name: z.string().min(1, 'Last name is required').max(100).optional(),
    email: z.string().email('Invalid email format').optional(),
    phone: z.string().min(10).max(20).nullable().optional(),
    avatar_url: z.string().url('Invalid avatar URL').nullable().optional(),
    remove_avatar: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
});

const userDashboardQuerySchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID').optional(),
});

const walletActionSchema = z.object({
  amount: positiveRupeeAmountSchema('Amount'),
  remarks: z.string().min(1, 'Remarks are required').max(500),
  organization_id: z.string().uuid('Invalid organization ID').optional(),
});

const scopedHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
  price: nonNegativeRupeeAmountSchema('Price'),
  currency: z.string().length(3).default('INR'),
  max_contacts: z.number().int().min(0).default(0),
  max_templates: z.number().int().min(0).default(0),
  max_campaigns_per_month: z.number().int().min(0).default(0),
  max_messages_per_month: z.number().int().min(0).default(0),
  max_team_members: z.number().int().min(0).default(0),
  max_organizations: z.number().int().min(0).default(1),
  max_whatsapp_numbers: z.number().int().min(0).default(1),
  has_priority_support: z.boolean().default(false),
  marketing_message_price: nonNegativeRupeeAmountSchema('Marketing message price').default(0),
  utility_message_price: nonNegativeRupeeAmountSchema('Utility message price').default(0),
  auth_message_price: nonNegativeRupeeAmountSchema('Authentication message price').default(0),
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

const couponBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Coupon code is required')
    .max(50)
    .transform((v) => v.toUpperCase()),
  description: z.string().trim().max(500).optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number({ invalid_type_error: 'Discount value must be a number' }).finite(
    'Discount value must be a valid number'
  ),
  max_uses: z.number().int().positive().nullable().optional(),
  min_plan_price: nonNegativeRupeeAmountSchema('Minimum plan price').nullable().optional(),
  applicable_plan_ids: z.array(z.string().uuid()).optional(),
  applicable_user_ids: z.array(z.string().uuid()).optional(),
  valid_from: z.string().min(1, 'Valid from is required'),
  valid_until: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

function refineCouponSchema(data, ctx) {
  if (data.discount_type === 'percentage') {
    if (!Number.isInteger(data.discount_value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discount_value'],
        message: 'Percentage discount must be a whole number',
      });
    }

    if (data.discount_value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discount_value'],
        message: 'Percentage discount cannot exceed 100',
      });
    }
  } else if (data.discount_value <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discount_value'],
      message: 'Discount amount must be greater than 0',
    });
  } else if (!isValidRupeeAmount(data.discount_value, { allowZero: false })) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discount_value'],
      message: 'Discount amount can have at most 2 decimal places',
    });
  }

  if (data.valid_until && new Date(data.valid_until) < new Date(data.valid_from)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['valid_until'],
      message: 'Valid until must be after valid from',
    });
  }
}

const createCouponSchema = couponBaseSchema.superRefine(refineCouponSchema);

const updateCouponSchema = couponBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.discount_value !== undefined) {
      if (!data.discount_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_type'],
          message: 'Discount type is required when discount value is provided',
        });
      } else if (data.discount_type === 'percentage') {
        if (!Number.isInteger(data.discount_value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discount_value'],
            message: 'Percentage discount must be a whole number',
          });
        }

        if (data.discount_value > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['discount_value'],
            message: 'Percentage discount cannot exceed 100',
          });
        }
      } else if (data.discount_value <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_value'],
          message: 'Discount amount must be greater than 0',
        });
      } else if (!isValidRupeeAmount(data.discount_value, { allowZero: false })) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_value'],
          message: 'Discount amount can have at most 2 decimal places',
        });
      }
    }

    if (data.valid_from && data.valid_until && new Date(data.valid_until) < new Date(data.valid_from)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valid_until'],
        message: 'Valid until must be after valid from',
      });
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

const listCouponsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  status: z.enum(['active', 'inactive', 'scheduled', 'expired']).optional(),
  discount_type: z.enum(['percentage', 'fixed']).optional(),
});

const couponStatusSchema = z.object({
  is_active: z.boolean(),
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

const validateUserInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
});

const acceptUserInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8).max(128),
});

module.exports = {
  createSubAdminSchema,
  inviteSubAdminSchema,
  updateSubAdminSchema,
  listUsersSchema,
  createUserSchema,
  inviteUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  userDashboardQuerySchema,
  walletActionSchema,
  scopedHistoryQuerySchema,
  createPlanSchema,
  updatePlanSchema,
  planStatusSchema,
  createCouponSchema,
  updateCouponSchema,
  listCouponsSchema,
  couponStatusSchema,
  createNotificationSchema,
  sendAdminEmailSchema,
  updateSettingsSchema,
  createRoleSchema,
  updateRoleSchema,
  idParamSchema,
  paginationSchema,
  validateAdminInvitationSchema,
  acceptAdminInvitationSchema,
  validateUserInvitationSchema,
  acceptUserInvitationSchema,
};
