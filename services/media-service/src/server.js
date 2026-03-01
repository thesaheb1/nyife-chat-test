'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { testConnection } = require('@nyife/shared-config');

const server = http.createServer(app);

async function startServer() {
  const dbConnected = await testConnection(sequelize, 'media-service');
  if (!dbConnected) {
    console.error('[media-service] Failed to connect to database. Exiting.');
    process.exit(1);
  }

  server.listen(config.port, () => {
    console.log(`[media-service] Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`[media-service] Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

const gracefulShutdown = (signal) => {
  console.log(`[media-service] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[media-service] HTTP server closed');

    try {
      await sequelize.close();
      console.log('[media-service] Database connection closed');
    } catch (err) {
      console.error('[media-service] Error closing database:', err.message);
    }

    console.log('[media-service] Graceful shutdown complete');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[media-service] Could not close connections in time — forcing shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('[media-service] Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[media-service] Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = server;
