'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection } = require('@nyife/shared-config');
const { disconnectKafka } = require('./services/organization.service');

// ---------------------------------------------------------------------------
// Create HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const startServer = async () => {
  // Test database connection
  const dbConnected = await testConnection(sequelize, 'organization-service');
  if (!dbConnected) {
    console.error('[organization-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  server.listen(config.port, () => {
    console.log(`[organization-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[organization-service] Health check: http://localhost:${config.port}/health`);
  });
};

startServer();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const gracefulShutdown = (signal) => {
  console.log(`[organization-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[organization-service] HTTP server closed');

    // Disconnect Kafka producer
    await disconnectKafka();

    // Close database connection
    try {
      await sequelize.close();
      console.log('[organization-service] Database connection closed');
    } catch (error) {
      console.error('[organization-service] Error closing database connection:', error.message);
    }

    console.log('[organization-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if connections are not drained
  setTimeout(() => {
    console.error('[organization-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('[organization-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[organization-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
