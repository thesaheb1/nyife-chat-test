'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Initializes Socket.IO on the HTTP server with Redis adapter for multi-instance
 * support, JWT authentication middleware on the /notifications namespace,
 * and user room management.
 *
 * @param {import('http').Server} server - Node.js HTTP server instance
 * @param {import('ioredis').Redis|null} redis - ioredis client instance (or null to skip adapter)
 * @returns {import('socket.io').Server} Configured Socket.IO server instance
 */
function setupSocketIO(server, redis) {
  const io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for horizontal scaling
  if (redis) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const Redis = require('ioredis');

      const pubClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      });

      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        console.error('[notification-service] Redis pub error:', err.message);
      });

      subClient.on('error', (err) => {
        console.error('[notification-service] Redis sub error:', err.message);
      });

      io.adapter(createAdapter(pubClient, subClient));
      console.log('[notification-service] Socket.IO Redis adapter initialized');
    } catch (err) {
      console.warn('[notification-service] Could not setup Redis adapter:', err.message);
    }
  }

  // Setup /notifications namespace
  const notificationsNs = io.of('/notifications');

  // JWT auth middleware on the /notifications namespace
  notificationsNs.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.id || decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler on the /notifications namespace
  notificationsNs.on('connection', (socket) => {
    console.log(`[notification-service] Socket connected: ${socket.id} (user: ${socket.userId})`);

    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', (reason) => {
      console.log(`[notification-service] Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
}

module.exports = { setupSocketIO };
