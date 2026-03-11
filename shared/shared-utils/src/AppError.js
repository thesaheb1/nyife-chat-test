'use strict';

/**
 * Custom application error class for consistent error handling across Nyife microservices.
 * Extends the native Error class with additional properties for HTTP status codes,
 * structured error details, and operational vs programming error distinction.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (4xx or 5xx)
   * @param {Array} errors - Array of detailed error objects (e.g., validation errors)
   * @param {boolean} isOperational - Whether this is an expected operational error (true) or a programming bug (false)
   * @param {string|null} code - Stable domain error code for frontend/API consumers
   */
  constructor(message, statusCode, errors = [], isOperational = true, code = null) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a 400 Bad Request error.
   * @param {string} message - Error message
   * @param {Array} errors - Detailed validation errors
   * @param {string|null} code - Stable domain error code
   * @returns {AppError}
   */
  static badRequest(message = 'Bad request', errors = [], code = null) {
    return new AppError(message, 400, errors, true, code);
  }

  /**
   * Creates a 401 Unauthorized error.
   * @param {string} message - Error message
   * @param {string|null} code - Stable domain error code
   * @returns {AppError}
   */
  static unauthorized(message = 'Unauthorized', code = null) {
    return new AppError(message, 401, [], true, code);
  }

  /**
   * Creates a 403 Forbidden error.
   * @param {string} message - Error message
   * @param {string|null} code - Stable domain error code
   * @returns {AppError}
   */
  static forbidden(message = 'Forbidden', code = null) {
    return new AppError(message, 403, [], true, code);
  }

  /**
   * Creates a 404 Not Found error.
   * @param {string} message - Error message
   * @param {string|null} code - Stable domain error code
   * @returns {AppError}
   */
  static notFound(message = 'Resource not found', code = null) {
    return new AppError(message, 404, [], true, code);
  }

  /**
   * Creates a 409 Conflict error.
   * @param {string} message - Error message
   * @param {string|null} code - Stable domain error code
   * @returns {AppError}
   */
  static conflict(message = 'Resource already exists', code = null) {
    return new AppError(message, 409, [], true, code);
  }

  /**
   * Creates a 500 Internal Server Error.
   * @param {string} message - Error message
   * @param {string|null} code - Stable domain error code
   * @returns {AppError}
   */
  static internal(message = 'Internal server error', code = null) {
    return new AppError(message, 500, [], false, code);
  }
}

module.exports = AppError;
