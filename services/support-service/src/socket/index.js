'use strict';

const { Server } = require('socket.io');
const Redis = require('ioredis');
const config = require('../config');
const supportService = require('../services/support.service');

function setupSocketIO(server, redis) {
  const io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/v1/support/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  if (redis) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const pubClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      });
      const subClient = pubClient.duplicate();

      pubClient.on('error', (error) => {
        console.error('[support-service] Socket.IO Redis pub client error:', error.message);
      });

      subClient.on('error', (error) => {
        console.error('[support-service] Socket.IO Redis sub client error:', error.message);
      });

      io.adapter(createAdapter(pubClient, subClient));
      console.log('[support-service] Socket.IO Redis adapter initialized');
    } catch (error) {
      console.warn('[support-service] Could not setup Redis adapter:', error.message);
    }
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const actor = await supportService.resolveRealtimeActor(token);
      socket.supportActor = actor;
      if (actor.mode === 'user') {
        socket.join(supportService.buildUserRoom(actor.actor.user.id));
      } else {
        socket.join(supportService.buildAdminRoom(actor.actor.user.id));
      }

      return next();
    } catch (error) {
      return next(new Error(error?.message || 'Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const actorId = socket.supportActor?.actor?.user?.id || 'unknown';
    const actorMode = socket.supportActor?.mode || 'unknown';
    console.log(`[support-service] Support socket connected: ${socket.id} (${actorMode}:${actorId})`);

    socket.on('support:thread.join', async ({ ticketId, organizationId }, ack = () => undefined) => {
      try {
        const { ticket } = await supportService.assertSocketTicketAccess(
          socket.supportActor,
          ticketId,
          organizationId || null
        );
        socket.join(supportService.buildTicketRoom(ticket.id));
        console.log(`[support-service] ${socket.id} joined support thread ${ticket.id}`);
        ack({ success: true, ticket_id: ticket.id });
      } catch (error) {
        ack({
          success: false,
          message: error?.message || 'Unable to join support thread.',
        });
      }
    });

    socket.on('support:thread.leave', ({ ticketId }) => {
      if (ticketId) {
        socket.leave(supportService.buildTicketRoom(ticketId));
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[support-service] Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

module.exports = { setupSocketIO };
