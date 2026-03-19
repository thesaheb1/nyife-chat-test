'use strict';

const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = require('./app');
const config = require('./config');

// ---------------------------------------------------------------------------
// Create HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(app);

const websocketProxyLogger = {
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => {
    if (config.nodeEnv !== 'production') {
      console.debug(...args);
    }
  },
};

function createSocketUpgradeProxy(target, label) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    logLevel: config.nodeEnv === 'production' ? 'warn' : 'debug',
    logProvider: () => websocketProxyLogger,
    onError: (err, _req, socket) => {
      console.error(`[api-gateway] WebSocket proxy error for ${label}: ${err.message}`);
      if (socket && typeof socket.destroy === 'function') {
        socket.destroy();
      }
    },
  });
}

const chatSocketProxy = createSocketUpgradeProxy(config.services.chat, 'chat');
const notificationSocketProxy = createSocketUpgradeProxy(config.services.notification, 'notification');
const supportSocketProxy = createSocketUpgradeProxy(config.services.support, 'support');

server.on('upgrade', (req, socket, head) => {
  const requestPath = (req.url || '').split('?')[0];

  if (requestPath.startsWith('/api/v1/chat/socket.io')) {
    chatSocketProxy.upgrade(req, socket, head);
    return;
  }

  if (requestPath.startsWith('/api/v1/notifications/socket.io')) {
    notificationSocketProxy.upgrade(req, socket, head);
    return;
  }

  if (requestPath.startsWith('/api/v1/support/socket.io')) {
    supportSocketProxy.upgrade(req, socket, head);
    return;
  }
});

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
    app.locals.redis = redisClient;
  } catch (err) {
    console.warn('[api-gateway] Could not connect to Redis — running without Redis:', err.message);
    redisClient = null;
    app.locals.redis = null;
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
