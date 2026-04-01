'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient, createKafkaProducer, createKafkaConsumer } = require('@nyife/shared-config');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const campaignService = require('./services/campaign.service');

const server = http.createServer(app);

let redis = null;
let kafkaProducer = null;
let kafkaConsumer = null;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'campaign-service');
  if (!dbConnected) {
    console.error('[campaign-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('campaign');
    app.locals.redis = redis;
    console.log('[campaign-service] Redis client initialized');
  } catch (err) {
    console.warn('[campaign-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer
  try {
    kafkaProducer = await createKafkaProducer('campaign-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[campaign-service] Kafka producer connected');
  } catch (err) {
    console.warn('[campaign-service] Could not connect to Kafka producer:', err.message);
    app.locals.kafkaProducer = null;
  }

  // Connect to Kafka consumer for campaign.status topic
  try {
    kafkaConsumer = await createKafkaConsumer('campaign-service', 'campaign-service-status-group');

    await kafkaConsumer.subscribe({
      topic: TOPICS.CAMPAIGN_STATUS,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(
            `[campaign-service] Received campaign.status: campaign=${payload.campaignId} contact=${payload.contactId} status=${payload.status}`
          );

          const result = await campaignService.handleStatusUpdate(payload);

          if (result && kafkaProducer) {
            await publishEvent(kafkaProducer, TOPICS.CAMPAIGN_LIVE, payload.campaignId, {
              campaignId: payload.campaignId,
              organizationId: result.organizationId,
              messageId: payload.messageId,
              status: payload.status,
              timestamp: payload.timestamp || new Date().toISOString(),
              stats: result.stats,
            });
          }
        } catch (err) {
          console.error('[campaign-service] Failed to process campaign.status:', err.message);
        }
      },
    });

    console.log('[campaign-service] Kafka consumer subscribed to campaign.status');
  } catch (err) {
    console.warn('[campaign-service] Could not start Kafka consumer:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`[campaign-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[campaign-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[campaign-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[campaign-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[campaign-service] Database connection closed');
    } catch (err) {
      console.error('[campaign-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[campaign-service] Redis connection closed');
      } catch (err) {
        console.error('[campaign-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[campaign-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[campaign-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[campaign-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[campaign-service] Error disconnecting Kafka producer:', err.message);
      }
    }

    console.log('[campaign-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[campaign-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[campaign-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[campaign-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
