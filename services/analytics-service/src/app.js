'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');

const config = require('./config');
const analyticsRoutes = require('./routes/analytics.routes');
const adminAnalyticsRoutes = require('./routes/adminAnalytics.routes');
const { errorHandler } = require('@nyife/shared-middleware');

// ──────────────────────────────────────────────────────────────────────────────
// Logger
// ──────────────────────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    config.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'analytics-service' },
  transports: [new winston.transports.Console()],
});

// ──────────────────────────────────────────────────────────────────────────────
// Express app
// ──────────────────────────────────────────────────────────────────────────────

const app = express();

app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-id', 'X-Organization-Id'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP logging
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// ──────────────────────────────────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────────────────

// User dashboard & metrics
app.use('/api/v1/analytics', analyticsRoutes);

// Admin dashboard & metrics
app.use('/api/v1/admin/analytics', adminAnalyticsRoutes);

// ──────────────────────────────────────────────────────────────────────────────
// 404 handler
// ──────────────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Global error handler
// ──────────────────────────────────────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;
