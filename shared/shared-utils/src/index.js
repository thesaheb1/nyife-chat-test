'use strict';

const AppError = require('./AppError');
const { successResponse, errorResponse } = require('./responseFormatter');
const { getPagination, getPaginationMeta } = require('./pagination');
const { encrypt, decrypt } = require('./encryption');
const {
  META_CREDENTIAL_SOURCES,
  allowLegacyMetaAccountTokenFallback,
  resolveMetaAccessCredential,
} = require('./metaCredentials');
const {
  phoneSchema,
  emailSchema,
  uuidSchema,
  paginationSchema,
  dateRangeSchema,
  searchSchema,
} = require('./validators');
const {
  generateUUID,
  generateApiToken,
  generateInvitationToken,
  calculateInvitationExpiry,
  slugify,
  sanitizeHtml,
  formatCurrency,
  resolveFrontendAppUrl,
} = require('./helpers');
const {
  CRUD_ACTIONS,
  ORGANIZATION_RESOURCE_DEFINITIONS,
  ORGANIZATION_RESOURCE_KEYS,
  ADMIN_RESOURCE_DEFINITIONS,
  ADMIN_RESOURCE_KEYS,
  ADMIN_ASSIGNABLE_RESOURCE_KEYS,
  ADMIN_RESERVED_RESOURCE_KEYS,
  ADMIN_PERMISSION_ALIASES,
  createResourcePermission,
  buildPermissionMap,
  buildFullPermissions,
  buildFullOrganizationPermissions,
  buildFullAdminPermissions,
  normalizePermissions,
  normalizeOrganizationPermissions,
  normalizeAdminPermissions,
  hasPermission,
  hasAnyPermission,
  assertPermission,
  isValidCrudAction,
} = require('./permissions');

module.exports = {
  // Error handling
  AppError,

  // Response formatting
  successResponse,
  errorResponse,

  // Pagination
  getPagination,
  getPaginationMeta,

  // Encryption
  encrypt,
  decrypt,
  META_CREDENTIAL_SOURCES,
  allowLegacyMetaAccountTokenFallback,
  resolveMetaAccessCredential,

  // Validators (Zod schemas)
  phoneSchema,
  emailSchema,
  uuidSchema,
  paginationSchema,
  dateRangeSchema,
  searchSchema,

  // Helpers
  generateUUID,
  generateApiToken,
  generateInvitationToken,
  calculateInvitationExpiry,
  slugify,
  sanitizeHtml,
  formatCurrency,
  resolveFrontendAppUrl,

  // Permissions
  CRUD_ACTIONS,
  ORGANIZATION_RESOURCE_DEFINITIONS,
  ORGANIZATION_RESOURCE_KEYS,
  ADMIN_RESOURCE_DEFINITIONS,
  ADMIN_RESOURCE_KEYS,
  ADMIN_ASSIGNABLE_RESOURCE_KEYS,
  ADMIN_RESERVED_RESOURCE_KEYS,
  ADMIN_PERMISSION_ALIASES,
  createResourcePermission,
  buildPermissionMap,
  buildFullPermissions,
  buildFullOrganizationPermissions,
  buildFullAdminPermissions,
  normalizePermissions,
  normalizeOrganizationPermissions,
  normalizeAdminPermissions,
  hasPermission,
  hasAnyPermission,
  assertPermission,
  isValidCrudAction,
};
