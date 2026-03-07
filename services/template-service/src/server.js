'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient } = require('@nyife/shared-config');
const { TOPICS } = require('@nyife/shared-events');
const flowService = require('./services/flow.service');

const server = http.createServer(app);

let redis = null;
let kafkaProducer = null;
let kafkaConsumer = null;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'template-service');
  if (!dbConnected) {
    console.error('[template-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('template');
    app.locals.redis = redis;
    console.log('[template-service] Redis client initialized');
  } catch (err) {
    console.warn('[template-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer (best-effort)
  try {
    const { createKafkaProducer } = require('@nyife/shared-config');
    kafkaProducer = await createKafkaProducer('template-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[template-service] Kafka producer connected');
  } catch (err) {
    console.warn('[template-service] Could not connect to Kafka:', err.message);
    app.locals.kafkaProducer = null;
  }

  try {
    const { createKafkaConsumer } = require('@nyife/shared-config');
    kafkaConsumer = await createKafkaConsumer('template-service', 'template-service-flow-group');
    await kafkaConsumer.subscribe({
      topic: TOPICS.WHATSAPP_FLOW_COMPLETED,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          await flowService.storeFlowSubmission(payload);
        } catch (err) {
          console.error('[template-service] Failed to process whatsapp.flow.completed:', err.message);
        }
      },
    });

    console.log('[template-service] Kafka consumer subscribed to whatsapp.flow.completed');
  } catch (err) {
    console.warn('[template-service] Could not start Kafka consumer:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`[template-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[template-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[template-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[template-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[template-service] Database connection closed');
    } catch (err) {
      console.error('[template-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[template-service] Redis connection closed');
      } catch (err) {
        console.error('[template-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[template-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[template-service] Error disconnecting Kafka:', err.message);
      }
    }

    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[template-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[template-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    console.log('[template-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[template-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[template-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[template-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
