'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient, createKafkaConsumer } = require('@nyife/shared-config');
const { TOPICS } = require('@nyife/shared-events');
const automationService = require('./services/automation.service');

const server = http.createServer(app);

let redis = null;
let kafkaConsumer = null;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'automation-service');
  if (!dbConnected) {
    console.error('[automation-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('automation');
    app.locals.redis = redis;
    console.log('[automation-service] Redis client initialized');
  } catch (err) {
    console.warn('[automation-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka consumer for inbound automation topics
  try {
    kafkaConsumer = await createKafkaConsumer('automation-service', 'automation-service-inbound-group');

    await kafkaConsumer.subscribe({
      topic: TOPICS.WEBHOOK_INBOUND,
      fromBeginning: false,
    });
    await kafkaConsumer.subscribe({
      topic: TOPICS.WHATSAPP_FLOW_COMPLETED,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          if (topic === TOPICS.WEBHOOK_INBOUND && payload.eventType === 'message') {
            await automationService.processInboundMessage(payload, redis);
          } else if (topic === TOPICS.WHATSAPP_FLOW_COMPLETED) {
            await automationService.processFlowSubmission(payload, redis);
          }
        } catch (err) {
          console.error('[automation-service] Failed to process automation topic:', err.message);
        }
      },
    });

    console.log('[automation-service] Kafka consumer subscribed to webhook.inbound and whatsapp.flow.completed');
  } catch (err) {
    console.warn('[automation-service] Could not start Kafka consumer:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`[automation-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[automation-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[automation-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[automation-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[automation-service] Database connection closed');
    } catch (err) {
      console.error('[automation-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[automation-service] Redis connection closed');
      } catch (err) {
        console.error('[automation-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[automation-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[automation-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    console.log('[automation-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[automation-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[automation-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[automation-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
