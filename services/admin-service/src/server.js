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
  const dbConnected = await testConnection(sequelize, 'admin-service');
  if (!dbConnected) {
    console.error('[admin-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('admin');
    app.locals.redis = redis;
    console.log('[admin-service] Redis client initialized');
  } catch (err) {
    console.warn('[admin-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer (for sending notifications)
  try {
    kafkaProducer = await createKafkaProducer('admin-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[admin-service] Kafka producer connected');
  } catch (err) {
    console.warn('[admin-service] Could not connect to Kafka producer:', err.message);
    app.locals.kafkaProducer = null;
  }

  server.listen(config.port, () => {
    console.log(`[admin-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[admin-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const gracefulShutdown = (signal) => {
  console.log(`[admin-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[admin-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[admin-service] Database connection closed');
    } catch (err) {
      console.error('[admin-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[admin-service] Redis connection closed');
      } catch (err) {
        console.error('[admin-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[admin-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[admin-service] Error disconnecting Kafka producer:', err.message);
      }
    }

    console.log('[admin-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[admin-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[admin-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[admin-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
