'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient } = require('@nyife/shared-config');

const server = http.createServer(app);

let redis = null;

async function startServer() {
  const dbConnected = await testConnection(sequelize, 'contact-service');
  if (!dbConnected) {
    console.error('[contact-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  try {
    redis = createRedisClient('contact');
    app.locals.redis = redis;
    console.log('[contact-service] Redis client initialized');
  } catch (err) {
    console.warn('[contact-service] Could not connect to Redis:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`[contact-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[contact-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

const gracefulShutdown = (signal) => {
  console.log(`[contact-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[contact-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[contact-service] Database connection closed');
    } catch (err) {
      console.error('[contact-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[contact-service] Redis connection closed');
      } catch (err) {
        console.error('[contact-service] Error closing Redis:', err.message);
      }
    }

    console.log('[contact-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[contact-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[contact-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[contact-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
