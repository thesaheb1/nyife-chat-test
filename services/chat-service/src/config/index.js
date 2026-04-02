'use strict';

require('dotenv').config();

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  port: parseInt(process.env.CHAT_SERVICE_PORT || '3008', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    consumerConcurrency: parsePositiveInt(process.env.CHAT_KAFKA_CONSUMER_CONCURRENCY, 12),
  },
  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3009',
  organizationServiceUrl: process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:3011',
};
