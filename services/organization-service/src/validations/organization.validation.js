'use strict';

const { z } = require('zod');
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const passwordMessage =
  'Temporary password must be at least 8 characters and contain uppercase, lowercase, number, and special character';

/**
 * Permission shape for a single resource.
 * Each resource has CRUD boolean flags.
 */
const resourcePermissionSchema = z.object({
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

/**
 * Full permissions object with a resources map.
 * Each key is a resource name (e.g., "contacts", "chat", "finance")
 * mapped to CRUD booleans.
 */
const permissionsSchema = z.object({
  resources: z.record(z.string(), resourcePermissionSchema).refine(
    (resources) => Object.keys(resources).length > 0,
    { message: 'At least one resource permission must be defined' }
  ),
});

/**
 * Schema for creating a new organization.
 */
const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(200, 'Organization name must not exceed 200 characters')
    .trim(),
  description: z
    .string()
    .max(5000, 'Description must not exceed 5000 characters')
    .trim()
    .optional(),
  logo_url: z
    .string()
    .url('Logo URL must be a valid URL')
    .max(500, 'Logo URL must not exceed 500 characters')
    .optional(),
});

/**
 * Schema for updating an existing organization.
 */
const updateOrgSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(200, 'Organization name must not exceed 200 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(5000, 'Description must not exceed 5000 characters')
    .trim()
    .optional(),
  logo_url: z
    .string()
    .url('Logo URL must be a valid URL')
    .max(500, 'Logo URL must not exceed 500 characters')
    .optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Schema for inviting a new team member.
 */
const inviteMemberSchema = z.object({
  first_name: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters')
    .trim(),
  last_name: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),
  role_title: z
    .string()
    .min(2, 'Role title must be at least 2 characters')
    .max(100, 'Role title must not exceed 100 characters')
    .trim(),
  permissions: permissionsSchema,
});

/**
 * Schema for updating an existing team member.
 */
const updateMemberSchema = z.object({
  role_title: z
    .string()
    .min(2, 'Role title must be at least 2 characters')
    .max(100, 'Role title must not exceed 100 characters')
    .trim()
    .optional(),
  permissions: permissionsSchema.optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

const createMemberAccountSchema = z.object({
  first_name: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must not exceed 50 characters')
    .trim(),
  last_name: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must not exceed 50 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),
  role_title: z
    .string()
    .min(2, 'Role title must be at least 2 characters')
    .max(100, 'Role title must not exceed 100 characters')
    .trim(),
  temporary_password: z.string().regex(passwordRegex, passwordMessage),
  permissions: permissionsSchema,
});

/**
 * Schema for validating organization ID route parameter.
 */
const orgIdParamSchema = z.object({
  id: z.string().uuid('Invalid organization ID format'),
});

/**
 * Schema for validating member ID route parameter.
 */
const memberIdParamSchema = z.object({
  memberId: z.string().uuid('Invalid member ID format'),
});

const invitationIdParamSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID format'),
});

const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
  resource: z.string().trim().min(1).optional(),
  permission: z.enum(['create', 'read', 'update', 'delete']).optional(),
});

const listInvitationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const internalValidateTeamMemberSchema = z.object({
  organization_id: z.string().uuid('Invalid organization ID format').optional(),
  member_user_id: z.string().uuid('Invalid member user ID format'),
  resource: z.string().min(1).default('chat'),
  permission: z.enum(['read', 'update']).default('update'),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  password: z.string().min(8).max(255).optional(),
});

const resolveOrgContextSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  organization_id: z.string().uuid('Invalid organization ID').nullable().optional(),
});

module.exports = {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberSchema,
  createMemberAccountSchema,
  orgIdParamSchema,
  memberIdParamSchema,
  invitationIdParamSchema,
  listMembersQuerySchema,
  listInvitationsQuerySchema,
  internalValidateTeamMemberSchema,
  acceptInvitationSchema,
  resolveOrgContextSchema,
  permissionsSchema,
  resourcePermissionSchema,
};
