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
  slugify,
  sanitizeHtml,
  formatCurrency,
} = require('./helpers');

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
  slugify,
  sanitizeHtml,
  formatCurrency,
};
