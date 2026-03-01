'use strict';

require('dotenv').config();

const Redis = require('ioredis');

/**
 * Creates a configured ioredis client instance.
 *
 * @param {string} [namespace] - Optional namespace prefix for key operations and logging context.
 * @returns {Redis} A configured ioredis client instance.
 */
function createRedisClient(namespace) {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const password = process.env.REDIS_PASSWORD || undefined;
  const prefix = namespace ? `${namespace}:` : '';
  const label = namespace || 'default';

  const client = new Redis({
    host,
    port,
    password,
    keyPrefix: prefix,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > 10) {
        console.error(`[Redis][${label}] Max retries (10) reached. Giving up.`);
        return null;
      }
      const delay = Math.min(times * 200, 5000);
      console.log(`[Redis][${label}] Retry attempt ${times}, reconnecting in ${delay}ms...`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((targetError) => err.message.includes(targetError));
    },
  });

  client.on('connect', () => {
    console.log(`[Redis][${label}] Connected to Redis at ${host}:${port}`);
  });

  client.on('ready', () => {
    console.log(`[Redis][${label}] Redis client is ready.`);
  });

  client.on('error', (err) => {
    console.error(`[Redis][${label}] Redis error:`, err.message);
  });

  client.on('close', () => {
    console.log(`[Redis][${label}] Redis connection closed.`);
  });

  client.on('reconnecting', (delay) => {
    console.log(`[Redis][${label}] Reconnecting to Redis in ${delay}ms...`);
  });

  client.on('end', () => {
    console.log(`[Redis][${label}] Redis connection ended.`);
  });

  return client;
}

module.exports = {
  createRedisClient,
};
