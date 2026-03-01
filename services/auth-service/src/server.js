'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient } = require('@nyife/shared-config');

const server = http.createServer(app);

let redis = null;
let kafkaProducer = null;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'auth-service');
  if (!dbConnected) {
    console.error('[auth-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('auth');
    app.locals.redis = redis;
    console.log('[auth-service] Redis client initialized');
  } catch (err) {
    console.warn('[auth-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer (best-effort)
  try {
    const { createKafkaProducer } = require('@nyife/shared-config');
    kafkaProducer = await createKafkaProducer('auth-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[auth-service] Kafka producer connected');
  } catch (err) {
    console.warn('[auth-service] Could not connect to Kafka:', err.message);
    app.locals.kafkaProducer = null;
  }

  server.listen(config.port, () => {
    console.log(`[auth-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[auth-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[auth-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[auth-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[auth-service] Database connection closed');
    } catch (err) {
      console.error('[auth-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[auth-service] Redis connection closed');
      } catch (err) {
        console.error('[auth-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[auth-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[auth-service] Error disconnecting Kafka:', err.message);
      }
    }

    console.log('[auth-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[auth-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[auth-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[auth-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
