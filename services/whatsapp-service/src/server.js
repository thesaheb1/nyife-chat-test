'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const {
  testConnection,
  createRedisClient,
  createKafkaProducerWithRetry,
  createKafkaConsumerWithRetry,
} = require('@nyife/shared-config');

const server = http.createServer(app);

let redis = null;
let kafkaProducer = null;
let kafkaConsumer = null;

async function startServer() {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'whatsapp-service');
  if (!dbConnected) {
    console.error('[whatsapp-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Connect to Redis
  try {
    redis = createRedisClient('whatsapp');
    app.locals.redis = redis;
    console.log('[whatsapp-service] Redis client initialized');
  } catch (err) {
    console.warn('[whatsapp-service] Could not connect to Redis:', err.message);
  }

  // Connect to Kafka producer (for publishing webhook events)
  try {
    kafkaProducer = await createKafkaProducerWithRetry('whatsapp-service');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[whatsapp-service] Kafka producer connected');
  } catch (err) {
    console.warn('[whatsapp-service] Could not connect to Kafka producer:', err.message);
    app.locals.kafkaProducer = null;
  }

  // Connect to Kafka consumer for campaign.execute topic
  try {
    const { TOPICS } = require('@nyife/shared-events');
    const { processCampaignExecuteMessage } = require('./services/campaignExecution.service');

    kafkaConsumer = await createKafkaConsumerWithRetry('whatsapp-service', 'whatsapp-service-campaign-group');

    await kafkaConsumer.subscribe({
      topic: TOPICS.CAMPAIGN_EXECUTE,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      partitionsConsumedConcurrently: config.kafka.consumerConcurrency,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(
            `[whatsapp-service] Received campaign.execute message: campaign=${payload.campaignId} phone=${payload.phoneNumber}`
          );

          await processCampaignExecuteMessage(payload, {
            kafkaProducer,
          });
        } catch (err) {
          console.error(
            `[whatsapp-service] Failed to process campaign.execute message:`,
            err.message
          );

          if (err.code === 'CAMPAIGN_DISPATCH_STATE_UNAVAILABLE') {
            throw err;
          }
        }
      },
    });

    console.log('[whatsapp-service] Kafka consumer subscribed to campaign.execute');
  } catch (err) {
    console.warn('[whatsapp-service] Could not start Kafka consumer:', err.message);
  }

  server.listen(config.port, () => {
    console.log(`[whatsapp-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[whatsapp-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`[whatsapp-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[whatsapp-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[whatsapp-service] Database connection closed');
    } catch (err) {
      console.error('[whatsapp-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[whatsapp-service] Redis connection closed');
      } catch (err) {
        console.error('[whatsapp-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[whatsapp-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[whatsapp-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[whatsapp-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[whatsapp-service] Error disconnecting Kafka producer:', err.message);
      }
    }

    console.log('[whatsapp-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[whatsapp-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[whatsapp-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[whatsapp-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
