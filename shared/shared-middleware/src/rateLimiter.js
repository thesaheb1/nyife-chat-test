'use strict';

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;

/**
 * Factory function that creates a configured express-rate-limit middleware instance.
 *
 * Supports both Redis-backed and in-memory stores. When a Redis client is provided,
 * rate limit counters are shared across all service instances (important for production
 * deployments with multiple replicas). Falls back to the default in-memory store
 * when no Redis client is given (suitable for development and testing).
 *
 * @param {Object} options - Configuration options
 * @param {number} [options.windowMs=60000] - Time window in milliseconds (default: 1 minute)
 * @param {number} [options.max=100] - Maximum number of requests per window (default: 100)
 * @param {string} [options.message] - Custom error message or object returned when limit is exceeded
 * @param {string} [options.keyPrefix='rl:'] - Prefix for Redis keys (helps namespace different limiters)
 * @param {import('ioredis').Redis} [options.redisClient] - Optional ioredis client instance for distributed rate limiting
 * @returns {Function} Configured express-rate-limit middleware
 *
 * @example
 * // With Redis (production)
 * const Redis = require('ioredis');
 * const redis = new Redis(process.env.REDIS_URL);
 * app.use('/api', createRateLimiter({ windowMs: 60000, max: 100, redisClient: redis }));
 *
 * @example
 * // Without Redis (development)
 * app.use('/api', createRateLimiter({ windowMs: 60000, max: 200 }));
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 60000,
    max = 100,
    message = {
      success: false,
      message: 'Too many requests, please try again later.',
    },
    keyPrefix = 'rl:',
    redisClient,
  } = options;

  const limiterConfig = {
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  };

  if (redisClient) {
    limiterConfig.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: keyPrefix,
    });
  }

  return rateLimit(limiterConfig);
};

module.exports = {
  createRateLimiter,
};
