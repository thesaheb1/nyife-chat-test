'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient, createKafkaConsumer } = require('@nyife/shared-config');
const { TOPICS } = require('@nyife/shared-events');
const emailService = require('./services/email.service');

const server = http.createServer(app);

let redis = null;
let kafkaConsumer = null;

/**
 * Starts the email-service: database, Redis, Kafka consumer, HTTP server.
 */
async function startServer() {
  // ── Database Connection ──────────────────────────
  const dbConnected = await testConnection(sequelize, 'email-service');
  if (!dbConnected) {
    console.error('[email-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // ── Redis Connection (optional, for caching) ─────
  try {
    redis = createRedisClient('email');
    app.locals.redis = redis;
    console.log('[email-service] Redis client initialized');
  } catch (err) {
    console.warn('[email-service] Could not connect to Redis:', err.message);
  }

  // ── Kafka Consumer for email.send ────────────────
  try {
    kafkaConsumer = await createKafkaConsumer('email-service', 'email-service-group');

    await kafkaConsumer.subscribe({
      topic: TOPICS.EMAIL_SEND,
      fromBeginning: false,
    });

    await kafkaConsumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());

          console.log(
            `[email-service] Received email.send: to=${payload.to_email || payload.to_emails?.[0]} template=${payload.template_name || 'none'}`
          );

          // Map Kafka payload to sendEmail format
          const emailData = {
            to_emails: payload.to_emails || (payload.to_email ? [payload.to_email] : []),
            to_names: payload.to_names || (payload.to_name ? [payload.to_name] : undefined),
            type: payload.type || 'transactional',
            subject: payload.subject,
            template_name: payload.template_name,
            variables: payload.variables,
            html_body: payload.html_body,
            text_body: payload.text_body,
            meta: payload.meta,
          };

          const results = await emailService.sendEmail(emailData);

          results.forEach((result) => {
            if (result.status === 'sent') {
              console.log(`[email-service] Email sent to ${result.to_email} (id=${result.id})`);
            } else {
              console.warn(
                `[email-service] Email to ${result.to_email} status=${result.status} (id=${result.id}): ${result.error_message || 'no error'}`
              );
            }
          });
        } catch (err) {
          console.error('[email-service] Failed to process email.send:', err.message);
        }
      },
    });

    console.log('[email-service] Kafka consumer subscribed to email.send');
  } catch (err) {
    console.warn('[email-service] Could not start Kafka consumer:', err.message);
  }

  // ── Start HTTP Server ────────────────────────────
  server.listen(config.port, () => {
    console.log(`[email-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[email-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// ────────────────────────────────────────────────
// Graceful Shutdown
// ────────────────────────────────────────────────

const gracefulShutdown = (signal) => {
  console.log(`[email-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[email-service] HTTP server closed');

    // Close database connection
    try {
      await sequelize.close();
      console.log('[email-service] Database connection closed');
    } catch (err) {
      console.error('[email-service] Error closing database:', err.message);
    }

    // Close Redis connection
    if (redis) {
      try {
        await redis.quit();
        console.log('[email-service] Redis connection closed');
      } catch (err) {
        console.error('[email-service] Error closing Redis:', err.message);
      }
    }

    // Disconnect Kafka consumer
    if (kafkaConsumer) {
      try {
        await kafkaConsumer.disconnect();
        console.log('[email-service] Kafka consumer disconnected');
      } catch (err) {
        console.error('[email-service] Error disconnecting Kafka consumer:', err.message);
      }
    }

    console.log('[email-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('[email-service] Could not close connections in time -- forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[email-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[email-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
