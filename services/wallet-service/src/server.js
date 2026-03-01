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
  const dbConnected = await testConnection(sequelize, 'wallet-service');
  if (!dbConnected) {
    console.error('[wallet-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('wallet');
    app.locals.redis = redis;
    console.log('[wallet-service] Redis client initialized');
  } catch (err) {
    console.warn('[wallet-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer (best-effort)
  try {
    const { createKafkaProducer } = require('@nyife/shared-config');
    kafkaProducer = await createKafkaProducer('wallet-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[wallet-service] Kafka producer connected');
  } catch (err) {
    console.warn('[wallet-service] Could not connect to Kafka:', err.message);
    app.locals.kafkaProducer = null;
  }

  server.listen(config.port, () => {
    console.log(`[wallet-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[wallet-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[wallet-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[wallet-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[wallet-service] Database connection closed');
    } catch (err) {
      console.error('[wallet-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[wallet-service] Redis connection closed');
      } catch (err) {
        console.error('[wallet-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[wallet-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[wallet-service] Error disconnecting Kafka:', err.message);
      }
    }

    console.log('[wallet-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[wallet-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[wallet-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[wallet-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
