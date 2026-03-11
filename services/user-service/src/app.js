'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { requestLogger, errorHandler } = require('@nyife/shared-middleware');

const config = require('./config');
const userRoutes = require('./routes/user.routes');

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// ---------------------------------------------------------------------------
// Trust proxy — required behind reverse proxy / load balancer so that
// rate limiting and req.ip work correctly.
// ---------------------------------------------------------------------------
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet());

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Organization-Id'],
  })
);

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// HTTP request logging
// ---------------------------------------------------------------------------
app.use(requestLogger);

// ---------------------------------------------------------------------------
// Health check — used by Docker, load balancers, and monitoring systems.
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------
app.use('/api/v1/users', userRoutes);

// ---------------------------------------------------------------------------
// 404 handler — any request that did not match a registered route
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'The requested resource was not found.',
  });
});

// ---------------------------------------------------------------------------
// Global error handler from shared-middleware
// ---------------------------------------------------------------------------
app.use(errorHandler);

module.exports = app;
