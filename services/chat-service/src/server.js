'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient, createKafkaConsumerWithRetry } = require('@nyife/shared-config');
const { setupSocketIO } = require('./socket');

const server = http.createServer(app);

let redis = null;
let io = null;
let kafkaConsumer = null;

/**
 * Starts the chat-service: database, Redis, Socket.IO, Kafka consumer, HTTP server.
 */
async function startServer() {
  // ── Database Connection ──────────────────────────
  const dbConnected = await testConnection(sequelize, 'chat-service');
  if (!dbConnected) {
    console.error('[chat-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // ── Redis Connection ─────────────────────────────
  try {
    redis = createRedisClient('chat');
    app.locals.redis = redis;
    console.log('[chat-service] Redis client initialized');
  } catch (err) {
    console.warn('[chat-service] Could not connect to Redis:', err.message);
  }

  // ── Socket.IO ────────────────────────────────────
  io = setupSocketIO(server, redis);
  app.locals.io = io;
  console.log('[chat-service] Socket.IO initialized');

  // ── Kafka Consumer for webhook.inbound ───────────
  try {
    const { TOPICS } = require('@nyife/shared-events');
    const chatService = require('./services/chat.service');

    kafkaConsumer = await createKafkaConsumerWithRetry('chat-service', 'chat-service-inbound-group');

    await kafkaConsumer.subscribe({
      topic: TOPICS.WEBHOOK_INBOUND,
      fromBeginning: false,
    });
    await kafkaConsumer.subscribe({
      topic: TOPICS.WHATSAPP_MESSAGE_STATUS,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      partitionsConsumedConcurrently: config.kafka.consumerConcurrency,
      eachMessage: async ({ topic, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());

          if (topic === TOPICS.WEBHOOK_INBOUND) {
            await chatService.handleInboundMessage(payload, io);
          } else if (topic === TOPICS.WHATSAPP_MESSAGE_STATUS) {
            await chatService.handleStatusUpdate(payload, io);
          }
        } catch (err) {
          console.error('[chat-service] Failed to process Kafka event:', err.message);
        }
      },
    });

    console.log('[chat-service] Kafka consumer subscribed to webhook.inbound and whatsapp.message.status');
  } catch (err) {
    console.warn('[chat-service] Could not start Kafka consumer:', err.message);
  }

  // ── Start HTTP Server ────────────────────────────
  server.listen(config.port, () => {
    console.log(`[chat-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[chat-service] Health check: http://localhost:${config.port}/health`);
    console.log(`[chat-service] Socket.IO path: /api/v1/chat/socket.io`);
  });
}

startServer();

// ────────────────────────────────────────────────
// Graceful Shutdown
// ────────────────────────────────────────────────

const gracefulShutdown = (signal) => {
  console.log(`[chat-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[chat-service] HTTP server closed');

    // Close database connection
    try {
      await sequelize.close();
      console.log('[chat-service] Database connection closed');
    } catch (err) {
      console.error('[chat-service] Error closing database:', err.message);
    }

    // Close Redis connection
    if (redis) {
      try {
        await redis.quit();
        console.log('[chat-service] Redis connection closed');
      } catch (err) {
        console.error('[chat-service] Error closing Redis:', err.message);
      }
    }

    // Disconnect Kafka consumer
    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[chat-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[chat-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    // Close Socket.IO
    if (io) {
      try {
        io.close();
        console.log('[chat-service] Socket.IO closed');
      } catch (err) {
        console.error('[chat-service] Error closing Socket.IO:', err.message);
      }
    }

    console.log('[chat-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[chat-service] Could not close connections in time - forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[chat-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[chat-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
