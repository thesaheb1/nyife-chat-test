'use strict';

const winston = require('winston');

/**
 * Application-level logger for error handling.
 * Outputs JSON-formatted logs in production for structured log parsing,
 * and colorized simple format in development for readability.
 */
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'error-handler' },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'development'
          ? winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
          : winston.format.json(),
    }),
  ],
});

/**
 * Custom application error class for operational errors.
 * Operational errors are expected errors that the application can handle
 * gracefully (e.g., validation failures, not found, unauthorized).
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string|null} code - Stable domain error code
   */
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Formats Zod validation errors into a consistent array of { field, message } objects.
 *
 * @param {import('zod').ZodError} err - The Zod validation error
 * @returns {{ field: string, message: string }[]} Array of field-level error descriptions
 */
const formatZodErrors = (err) => {
  return err.errors.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
};

/**
 * Formats Sequelize validation errors into a consistent array of { field, message } objects.
 *
 * @param {import('sequelize').ValidationError} err - The Sequelize validation error
 * @returns {{ field: string, message: string }[]} Array of field-level error descriptions
 */
const formatSequelizeValidationErrors = (err) => {
  return err.errors.map((e) => ({
    field: e.path,
    message: e.message,
  }));
};

/**
 * Express error-handling middleware.
 * Must be registered AFTER all route handlers (4-argument signature required).
 *
 * Handles the following error types:
 * - ZodError: input validation failures (400)
 * - Sequelize ValidationError: model validation failures (400)
 * - Sequelize UniqueConstraintError: duplicate resource (409)
 * - Sequelize ForeignKeyConstraintError: invalid reference (400)
 * - AppError: custom operational errors (dynamic status code)
 * - JsonWebTokenError: invalid JWT (401)
 * - TokenExpiredError: expired JWT (401)
 * - All unhandled errors: 500 Internal Server Error
 *
 * @param {Error} err - The error object
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user ? req.user.id : null,
  });

  // ZodError — input validation failure
  if (err.name === 'ZodError') {
    const errors = formatZodErrors(err);
    const response = {
      success: false,
      message: 'Validation failed',
      errors,
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(400).json(response);
  }

  // Sequelize UniqueConstraintError — duplicate entry
  // Must check before generic ValidationError since UniqueConstraintError extends it
  if (err.name === 'SequelizeUniqueConstraintError') {
    const response = {
      success: false,
      message: 'Resource already exists',
      errors: formatSequelizeValidationErrors(err),
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(409).json(response);
  }

  // Sequelize ValidationError — model validation failure
  if (err.name === 'SequelizeValidationError') {
    const errors = formatSequelizeValidationErrors(err);
    const response = {
      success: false,
      message: 'Validation failed',
      errors,
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(400).json(response);
  }

  // Sequelize ForeignKeyConstraintError — invalid FK reference
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    const response = {
      success: false,
      message: 'Invalid reference',
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(400).json(response);
  }

  // Custom AppError — operational error with known status
  if (err.isOperational) {
    const response = {
      success: false,
      message: err.message,
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(err.statusCode).json(response);
  }

  // JsonWebTokenError — invalid token
  if (err.name === 'JsonWebTokenError') {
    const response = {
      success: false,
      message: 'Invalid token',
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(401).json(response);
  }

  // TokenExpiredError — expired token
  if (err.name === 'TokenExpiredError') {
    const response = {
      success: false,
      message: 'Token expired',
      ...(err.code ? { code: err.code } : {}),
    };
    if (isDevelopment) {
      response.stack = err.stack;
    }
    return res.status(401).json(response);
  }

  // Unhandled / unexpected errors — 500
  const response = {
    success: false,
    message: 'Internal server error',
    ...(err.code ? { code: err.code } : {}),
  };
  if (isDevelopment) {
    response.message = err.message;
    response.stack = err.stack;
  }
  return res.status(500).json(response);
};

module.exports = {
  errorHandler,
  AppError,
};
