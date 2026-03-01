'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const winston = require('winston');
const path = require('path');

const config = require('./config');
const mediaRoutes = require('./routes/media.routes');
const { errorHandler } = require('@nyife/shared-middleware');

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    config.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  defaultMeta: { service: 'media-service' },
  transports: [new winston.transports.Console()],
});

const app = express();

app.set('trust proxy', 1);
app.use(helmet());

app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const morganFormat = config.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Serve uploaded files statically (for internal access)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'media-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/v1/media', mediaRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use(errorHandler);

module.exports = app;
