'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection, createRedisClient } = require('@nyife/shared-config');
const subscriptionService = require('./services/subscription.service');

const server = http.createServer(app);

let redis = null;

async function startServer() {
  const dbConnected = await testConnection(sequelize, 'subscription-service');
  if (!dbConnected) {
    console.error('[subscription-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  try {
    redis = createRedisClient('subscription');
    app.locals.redis = redis;
    console.log('[subscription-service] Redis client initialized');
  } catch (err) {
    console.warn('[subscription-service] Could not connect to Redis:', err.message);
  }

  // Schedule daily expiry check and monthly reset
  scheduleJobs();

  server.listen(config.port, () => {
    console.log(`[subscription-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[subscription-service] Health check: http://localhost:${config.port}/health`);
  });
}

function scheduleJobs() {
  // Process due renewals and expirations every 10 minutes
  setInterval(async () => {
    try {
      const result = await subscriptionService.checkAndExpireSubscriptions();
      if (result.processed_count > 0) {
        console.log(
          `[subscription-service] Renewal sweep processed=${result.processed_count} renewed=${result.renewed_count} grace=${result.grace_count} expired=${result.expired_count}`
        );
      }
    } catch (err) {
      console.error('[subscription-service] Renewal sweep failed:', err.message);
    }
  }, 10 * 60 * 1000); // 10 minutes

  // Reset monthly usage on the 1st of each month (check every hour)
  setInterval(async () => {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 0) {
      try {
        const result = await subscriptionService.resetMonthlyUsage();
        console.log(`[subscription-service] Monthly usage reset for ${result.reset_count} subscriptions`);
      } catch (err) {
        console.error('[subscription-service] Monthly reset failed:', err.message);
      }
    }
  }, 60 * 60 * 1000); // Check hourly
}

startServer();

const gracefulShutdown = (signal) => {
  console.log(`[subscription-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[subscription-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[subscription-service] Database connection closed');
    } catch (err) {
      console.error('[subscription-service] Error closing database:', err.message);
    }

    if (redis) {
      try {
        await redis.quit();
        console.log('[subscription-service] Redis connection closed');
      } catch (err) {
        console.error('[subscription-service] Error closing Redis:', err.message);
      }
    }

    console.log('[subscription-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[subscription-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[subscription-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[subscription-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
