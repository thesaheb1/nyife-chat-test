'use strict';

/**
 * Sends a standardized success JSON response.
 *
 * @param {import('express').Response} res - Express response object
 * @param {*} data - Response payload
 * @param {string} message - Human-readable success message
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {object|null} meta - Pagination or additional metadata (omitted if null)
 */
const successResponse = (res, data, message = 'Success', statusCode = 200, meta = null) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta !== null) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Sends a standardized error JSON response.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Human-readable error message
 * @param {Array} errors - Array of detailed error objects (omitted if empty)
 * @param {number} statusCode - HTTP status code (default 500)
 */
const errorResponse = (res, message = 'Error', errors = [], statusCode = 500) => {
  const response = {
    success: false,
    message,
  };

  if (Array.isArray(errors) && errors.length > 0) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse,
};
