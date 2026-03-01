'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');

// ---------------------------------------------------------------------------
// Create HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Optional Redis connection — used for shared rate-limit state, caching, etc.
// The gateway creates the connection eagerly so it is available to middleware.
// If Redis is not reachable the gateway still starts (graceful degradation).
// ---------------------------------------------------------------------------
let redisClient = null;

const connectRedis = async () => {
  try {
    const Redis = require('ioredis');
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) {
          console.warn('[api-gateway] Redis retry limit reached — running without Redis');
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('[api-gateway] Connected to Redis');
    });

    redisClient.on('error', (err) => {
      console.error('[api-gateway] Redis error:', err.message);
    });

    await redisClient.connect();
  } catch (err) {
    console.warn('[api-gateway] Could not connect to Redis — running without Redis:', err.message);
    redisClient = null;
  }
};

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
const startServer = async () => {
  // Attempt Redis connection (non-blocking for startup)
  await connectRedis();

  server.listen(config.port, () => {
    console.log(`[api-gateway] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[api-gateway] Health check: http://localhost:${config.port}/health`);
  });
};

startServer();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const gracefulShutdown = (signal) => {
  console.log(`[api-gateway] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[api-gateway] HTTP server closed');

    // Disconnect Redis if connected
    if (redisClient) {
      try {
        await redisClient.quit();
        console.log('[api-gateway] Redis connection closed');
      } catch (err) {
        console.error('[api-gateway] Error closing Redis connection:', err.message);
      }
    }

    console.log('[api-gateway] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if connections are not drained
  setTimeout(() => {
    console.error('[api-gateway] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[api-gateway] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[api-gateway] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
