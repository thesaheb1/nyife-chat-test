'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize, EmailTemplate } = require('./models');
const { testConnection, createRedisClient, createKafkaConsumer } = require('@nyife/shared-config');
const { TOPICS } = require('@nyife/shared-events');
const emailService = require('./services/email.service');
const coreTemplateSeeder = require('./seeders/20240101000001-seed-email-templates');

const server = http.createServer(app);

let redis = null;
let kafkaConsumer = null;
let kafkaConsumerRetryTimer = null;
let kafkaConsumerConnecting = false;

const KAFKA_CONSUMER_RETRY_DELAY_MS = 5000;

function normalizeTemplateName(name) {
  if (!name) {
    return undefined;
  }

  return String(name).trim().replace(/-/g, '_');
}

/**
 * Starts the email-service: database, Redis, Kafka consumer, HTTP server.
 */
async function startKafkaConsumer() {
  if (kafkaConsumerConnecting || kafkaConsumer) {
    return;
  }

  kafkaConsumerConnecting = true;

  try {
    const consumer = await createKafkaConsumer('email-service', 'email-service-group');

    await consumer.subscribe({
      topic: TOPICS.EMAIL_SEND,
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          const toEmails = Array.isArray(payload.to_emails) && payload.to_emails.length > 0
            ? payload.to_emails
            : Array.isArray(payload.recipients) && payload.recipients.length > 0
              ? payload.recipients
              : payload.to_email
                ? [payload.to_email]
                : payload.to
                  ? [payload.to]
                  : [];
          const templateName = normalizeTemplateName(payload.template_name || payload.template);

          console.log(
            `[email-service] Received email.send: to=${toEmails?.[0] || 'none'} template=${templateName || 'none'}`
          );

          // Map Kafka payload to sendEmail format
          const emailData = {
            to_emails: toEmails,
            to_names:
              payload.to_names
              || payload.recipient_names
              || (payload.to_name ? [payload.to_name] : undefined),
            type: payload.type || 'transactional',
            subject: payload.subject,
            template_name: templateName,
            variables: payload.variables || payload.templateData,
            html_body: payload.html_body || payload.html,
            text_body: payload.text_body || payload.text,
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

    kafkaConsumer = consumer;
    console.log('[email-service] Kafka consumer subscribed to email.send');
  } catch (err) {
    console.warn('[email-service] Could not start Kafka consumer:', err.message);

    if (kafkaConsumerRetryTimer) {
      clearTimeout(kafkaConsumerRetryTimer);
    }

    kafkaConsumerRetryTimer = setTimeout(() => {
      kafkaConsumerRetryTimer = null;
      startKafkaConsumer().catch((retryError) => {
        console.error('[email-service] Kafka retry bootstrap failed:', retryError.message);
      });
    }, KAFKA_CONSUMER_RETRY_DELAY_MS);
  } finally {
    kafkaConsumerConnecting = false;
  }
}

async function ensureCoreTemplates() {
  const totalTemplates = await EmailTemplate.count();

  if (totalTemplates > 0) {
    return;
  }

  console.warn('[email-service] email_templates is empty. Bootstrapping core templates.');
  await coreTemplateSeeder.up(sequelize.getQueryInterface());
}

async function startServer() {
  // ── Database Connection ──────────────────────────
  const dbConnected = await testConnection(sequelize, 'email-service');
  if (!dbConnected) {
    console.error('[email-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  await ensureCoreTemplates();

  // ── Redis Connection (optional, for caching) ─────
  try {
    redis = createRedisClient('email');
    app.locals.redis = redis;
    console.log('[email-service] Redis client initialized');
  } catch (err) {
    console.warn('[email-service] Could not connect to Redis:', err.message);
  }

  // ── Kafka Consumer for email.send ────────────────
  void startKafkaConsumer();

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

    if (kafkaConsumerRetryTimer) {
      clearTimeout(kafkaConsumerRetryTimer);
      kafkaConsumerRetryTimer = null;
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
