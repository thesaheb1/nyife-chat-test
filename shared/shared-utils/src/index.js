'use strict';

const AppError = require('./AppError');
const { successResponse, errorResponse } = require('./responseFormatter');
const { getPagination, getPaginationMeta } = require('./pagination');
const { encrypt, decrypt } = require('./encryption');
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
