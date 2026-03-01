'use strict';

const morgan = require('morgan');

/**
 * Creates a configured Morgan HTTP request logging middleware.
 *
 * In development:
 *   Uses Morgan's built-in 'dev' format for colorized, concise output.
 *
 * In production:
 *   Outputs structured JSON logs with the following fields:
 *   - method: HTTP method (GET, POST, etc.)
 *   - url: Request URL path
 *   - status: HTTP response status code
 *   - responseTime: Time to process request in milliseconds
 *   - contentLength: Response content length in bytes
 *   - timestamp: ISO 8601 timestamp
 *
 * Structured JSON output enables integration with log aggregation tools
 * (e.g., ELK stack, Datadog, CloudWatch) for monitoring and alerting.
 */

/**
 * Custom Morgan token format for production JSON logging.
 * Each log entry is a single JSON object on one line for easy parsing.
 */
const jsonFormat = (tokens, req, res) => {
  const logEntry = {
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: parseInt(tokens.status(req, res), 10) || 0,
    responseTime: parseFloat(tokens['response-time'](req, res)) || 0,
    contentLength: tokens.res(req, res, 'content-length') || '0',
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(logEntry);
};

/**
 * The configured request logger middleware.
 * Automatically selects the appropriate format based on NODE_ENV.
 */
const requestLogger =
  process.env.NODE_ENV === 'development'
    ? morgan('dev')
    : morgan(jsonFormat);

module.exports = {
  requestLogger,
};
