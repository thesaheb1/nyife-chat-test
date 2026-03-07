'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');

const config = require('./config');
const templateRoutes = require('./routes/template.routes');
const flowRoutes = require('./routes/flow.routes');
const { errorHandler } = require('@nyife/shared-middleware');

// Logger
const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    config.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'template-service' },
  transports: [new winston.transports.Console()],
});

const app = express();

app.set('trust proxy', 1);

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-user-id',
      'x-tenant-user-id',
      'x-user-role',
      'x-wa-access-token',
    ],
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP logging
const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'template-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Template routes
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/flows', flowRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
