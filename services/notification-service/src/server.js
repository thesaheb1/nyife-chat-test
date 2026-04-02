'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const {
  testConnection,
  createRedisClient,
  createKafkaConsumerWithRetry,
  createKafkaProducerWithRetry,
} = require('@nyife/shared-config');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const { setupSocketIO } = require('./socket');
const notificationService = require('./services/notification.service');
const { emitCampaignRealtime } = require('./services/campaignRealtime.service');

const server = http.createServer(app);

let redis = null;
let io = null;
let kafkaConsumer = null;
let kafkaProducer = null;

/**
 * Starts the notification-service: database, Redis, Socket.IO, Kafka consumer + producer, HTTP server.
 */
async function startServer() {
  // ── Database Connection ──────────────────────────
  const dbConnected = await testConnection(sequelize, 'notification-service');
  if (!dbConnected) {
    console.error('[notification-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // ── Redis Connection ─────────────────────────────
  try {
    redis = createRedisClient('notification');
    app.locals.redis = redis;
    console.log('[notification-service] Redis client initialized');
  } catch (err) {
    console.warn('[notification-service] Could not connect to Redis:', err.message);
  }

  // ── Socket.IO ────────────────────────────────────
  io = setupSocketIO(server, redis);
  app.locals.io = io;
  console.log('[notification-service] Socket.IO initialized (namespace: /notifications)');

  // Set app reference on the notification service so it can access io
  notificationService.setApp(app);

  // ── Kafka Producer ───────────────────────────────
  try {
    kafkaProducer = await createKafkaProducerWithRetry('notification-service-producer');
    app.locals.kafkaProducer = kafkaProducer;
    console.log('[notification-service] Kafka producer initialized');
  } catch (err) {
    console.warn('[notification-service] Could not start Kafka producer:', err.message);
  }

  // ── Kafka Consumer for notification.send + campaign.live ─────────
  try {
    kafkaConsumer = await createKafkaConsumerWithRetry('notification-service', 'notification-service-group');

    await kafkaConsumer.subscribe({
      topic: TOPICS.NOTIFICATION_SEND,
      fromBeginning: false,
    });
    await kafkaConsumer.subscribe({
      topic: TOPICS.CAMPAIGN_LIVE,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());

          if (topic === TOPICS.CAMPAIGN_LIVE) {
            await emitCampaignRealtime(io, payload);
            return;
          }

          console.log(
            `[notification-service] Received notification.send: userId=${payload.userId} type=${payload.type} title="${payload.title}"`
          );

          await notificationService.createNotification(payload.userId, {
            type: payload.type,
            title: payload.title,
            body: payload.body,
            meta: payload.meta,
            category: payload.category,
            sender_type: payload.sender_type || 'system',
            action_url: payload.action_url || null,
          });

          // If notification type warrants email, publish to email.send
          if (payload.sendEmail) {
            const producer = app.locals.kafkaProducer;
            if (producer) {
              try {
                await publishEvent(producer, TOPICS.EMAIL_SEND, payload.userId, {
                  to: payload.email,
                  subject: payload.title,
                  html: payload.body,
                  template: payload.emailTemplate || null,
                  templateData: payload.emailVariables || {},
                });
              } catch (emailErr) {
                console.error('[notification-service] Failed to publish email.send event:', emailErr.message);
              }
            }
          }
        } catch (err) {
          console.error('[notification-service] Failed to process notification.send:', err.message);
        }
      },
    });

    console.log('[notification-service] Kafka consumer subscribed to notification.send and campaign.live');
  } catch (err) {
    console.warn('[notification-service] Could not start Kafka consumer:', err.message);
  }

  // ── Start HTTP Server ────────────────────────────
  server.listen(config.port, () => {
    console.log(`[notification-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[notification-service] Health check: http://localhost:${config.port}/health`);
    console.log(`[notification-service] Socket.IO path: /api/v1/notifications/socket.io (namespace: /notifications)`);
  });
}

startServer();

// ────────────────────────────────────────────────
// Graceful Shutdown
// ────────────────────────────────────────────────

const gracefulShutdown = (signal) => {
  console.log(`[notification-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[notification-service] HTTP server closed');

    // Close database connection
    try {
      await sequelize.close();
      console.log('[notification-service] Database connection closed');
    } catch (err) {
      console.error('[notification-service] Error closing database:', err.message);
    }

    // Close Redis connection
    if (redis) {
      try {
        await redis.quit();
        console.log('[notification-service] Redis connection closed');
      } catch (err) {
        console.error('[notification-service] Error closing Redis:', err.message);
      }
    }

    // Disconnect Kafka consumer
    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[notification-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[notification-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    // Disconnect Kafka producer
    if (kafkaProducer) {
      try {
        await kafkaProducer.disconnect();
        console.log('[notification-service] Kafka producer disconnected');
      } catch (err) {
        console.error('[notification-service] Error disconnecting Kafka producer:', err.message);
      }
    }

    // Close Socket.IO
    if (io) {
      try {
        io.close();
        console.log('[notification-service] Socket.IO closed');
      } catch (err) {
        console.error('[notification-service] Error closing Socket.IO:', err.message);
      }
    }

    console.log('[notification-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[notification-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[notification-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[notification-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
