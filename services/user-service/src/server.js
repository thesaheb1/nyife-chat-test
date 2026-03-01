'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection } = require('@nyife/shared-config');

// ---------------------------------------------------------------------------
// Create HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------
const startServer = async () => {
  // Test database connection before accepting traffic
  const dbConnected = await testConnection(sequelize, 'user-service');

  if (!dbConnected) {
    console.error('[user-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  server.listen(config.port, () => {
    console.log(`[user-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[user-service] Health check: http://localhost:${config.port}/health`);
  });
};

startServer();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const gracefulShutdown = (signal) => {
  console.log(`[user-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[user-service] HTTP server closed');

    // Close database connection pool
    try {
      await sequelize.close();
      console.log('[user-service] Database connection closed');
    } catch (err) {
      console.error('[user-service] Error closing database connection:', err.message);
    }

    console.log('[user-service] Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if connections are not drained
  setTimeout(() => {
    console.error('[user-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[user-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[user-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
