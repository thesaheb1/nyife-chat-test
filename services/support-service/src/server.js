'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient, createKafkaProducer } = require('@nyife/shared-config');

const server = http.createServer(app);

let redis = null;
let kafkaProducer = null;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'support-service');
  if (!dbConnected) {
    console.error('[support-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('support');
    app.locals.redis = redis;
    console.log('[support-service] Redis client initialized');
  } catch (err) {
    console.warn('[support-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer (for sending notifications)
  try {
    kafkaProducer = await createKafkaProducer('support-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[support-service] Kafka producer connected');
  } catch (err) {
    console.warn('[support-service] Could not connect to Kafka producer:', err.message);
    app.locals.kafkaProducer = null;
  }

  // No Kafka consumer needed for support-service.
  // Notifications are published to Kafka but consumed by notification-service.

  server.listen(config.port, () => {
    console.log(`[support-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[support-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// ────────────────────────────────────────────────
// Graceful shutdown
// ────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  console.log(`[support-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[support-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[support-service] Database connection closed');
    } catch (err) {
      console.error('[support-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[support-service] Redis connection closed');
      } catch (err) {
        console.error('[support-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[support-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[support-service] Error disconnecting Kafka producer:', err.message);
      }
    }

    console.log('[support-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[support-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[support-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[support-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
