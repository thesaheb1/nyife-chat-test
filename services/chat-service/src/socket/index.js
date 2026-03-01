'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Initializes Socket.IO on the HTTP server with Redis adapter for multi-instance
 * support, JWT authentication middleware, and conversation room management.
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

  // Redis adapter for horizontal scaling (multiple service instances)
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
        console.error('[chat-service] Socket.IO Redis pub client error:', err.message);
      });

      subClient.on('error', (err) => {
        console.error('[chat-service] Socket.IO Redis sub client error:', err.message);
      });

      io.adapter(createAdapter(pubClient, subClient));
      console.log('[chat-service] Socket.IO Redis adapter initialized');
    } catch (err) {
      console.warn('[chat-service] Could not setup Redis adapter:', err.message);
    }
  }

  // JWT authentication middleware for Socket.IO connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.id || decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[chat-service] Socket connected: ${socket.id} (user: ${userId})`);

    // Auto-join the user's personal room for dashboard-level events
    socket.join(`user:${userId}`);

    /**
     * Join a specific conversation room to receive real-time messages.
     * Client emits: socket.emit('join:conversation', { conversationId })
     */
    socket.on('join:conversation', ({ conversationId }) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
        console.log(`[chat-service] Socket ${socket.id} joined conversation:${conversationId}`);
      }
    });

    /**
     * Leave a specific conversation room.
     * Client emits: socket.emit('leave:conversation', { conversationId })
     */
    socket.on('leave:conversation', ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        console.log(`[chat-service] Socket ${socket.id} left conversation:${conversationId}`);
      }
    });

    /**
     * Typing indicator broadcast.
     * Client emits: socket.emit('typing', { conversationId })
     * Other clients receive: 'typing:indicator' event
     */
    socket.on('typing', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:indicator', {
          conversationId,
          senderType: 'user',
          userId,
        });
      }
    });

    /**
     * Stop typing indicator broadcast.
     * Client emits: socket.emit('stop:typing', { conversationId })
     */
    socket.on('stop:typing', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[chat-service] Socket disconnected: ${socket.id} (reason: ${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`[chat-service] Socket error ${socket.id}:`, err.message);
    });
  });

  return io;
}

module.exports = { setupSocketIO };
