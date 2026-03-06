'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient, createKafkaConsumer } = require('@nyife/shared-config');
const { TOPICS } = require('@nyife/shared-events');
const analyticsService = require('./services/analytics.service');

const server = http.createServer(app);

let redis = null;
let kafkaConsumer = null;

async function startServer() {
  // ── Database connection ────────────────────────────────────────────────────
  const dbConnected = await testConnection(sequelize, 'analytics-service');
  if (!dbConnected) {
    console.error('[analytics-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Store sequelize in app.locals so controllers can use it for raw queries
  app.locals.sequelize = sequelize;

  // ── Redis connection ───────────────────────────────────────────────────────
  try {
    redis = createRedisClient('analytics');
    app.locals.redis = redis;
    console.log('[analytics-service] Redis client initialized');
  } catch (err) {
    console.warn('[analytics-service] Could not connect to Redis:', err.message);
    app.locals.redis = null;
  }

  // ── Kafka consumer ─────────────────────────────────────────────────────────
  try {
    kafkaConsumer = await createKafkaConsumer('analytics-service', 'analytics-service-group');

    await kafkaConsumer.subscribe({
      topics: [
        TOPICS.CAMPAIGN_ANALYTICS,
        TOPICS.WALLET_TRANSACTION,
        TOPICS.USER_EVENTS,
        TOPICS.WEBHOOK_INBOUND,
      ],
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(
            `[analytics-service] Received ${topic}: ${JSON.stringify(payload).slice(0, 200)}`
          );

          switch (topic) {
            case TOPICS.CAMPAIGN_ANALYTICS:
              await analyticsService.processCampaignAnalytics(payload, sequelize, redis);
              break;
            case TOPICS.WALLET_TRANSACTION:
              await analyticsService.processWalletTransaction(payload, sequelize, redis);
              break;
            case TOPICS.USER_EVENTS:
              await analyticsService.processUserEvent(payload, sequelize, redis);
              break;
            case TOPICS.WEBHOOK_INBOUND:
              await analyticsService.processWebhookInbound(payload, sequelize, redis);
              break;
            default:
              console.warn(`[analytics-service] Unhandled topic: ${topic}`);
          }
        } catch (err) {
          console.error(`[analytics-service] Failed to process ${topic}:`, err.message);
        }
      },
    });

    console.log('[analytics-service] Kafka consumer subscribed to:', [
      TOPICS.CAMPAIGN_ANALYTICS,
      TOPICS.WALLET_TRANSACTION,
      TOPICS.USER_EVENTS,
      TOPICS.WEBHOOK_INBOUND,
    ].join(', '));
  } catch (err) {
    console.warn('[analytics-service] Could not start Kafka consumer:', err.message);
  }

  // ── Start HTTP server ──────────────────────────────────────────────────────
  server.listen(config.port, () => {
    console.log(`[analytics-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[analytics-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// ──────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────────────────────────────────────

const gracefulShutdown = (signal) => {
  console.log(`[analytics-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[analytics-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[analytics-service] Database connection closed');
    } catch (err) {
      console.error('[analytics-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[analytics-service] Redis connection closed');
      } catch (err) {
        console.error('[analytics-service] Error closing Redis:', err.message);
      }
    }

    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[analytics-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[analytics-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    console.log('[analytics-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[analytics-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[analytics-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[analytics-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
