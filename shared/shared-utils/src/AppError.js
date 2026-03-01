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
   */
  constructor(message, statusCode, errors = [], isOperational = true) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a 400 Bad Request error.
   * @param {string} message - Error message
   * @param {Array} errors - Detailed validation errors
   * @returns {AppError}
   */
  static badRequest(message = 'Bad request', errors = []) {
    return new AppError(message, 400, errors);
  }

  /**
   * Creates a 401 Unauthorized error.
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  /**
   * Creates a 403 Forbidden error.
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  /**
   * Creates a 404 Not Found error.
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  /**
   * Creates a 409 Conflict error.
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static conflict(message = 'Resource already exists') {
    return new AppError(message, 409);
  }

  /**
   * Creates a 500 Internal Server Error.
   * @param {string} message - Error message
   * @returns {AppError}
   */
  static internal(message = 'Internal server error') {
    return new AppError(message, 500, [], false);
  }
}

module.exports = AppError;
