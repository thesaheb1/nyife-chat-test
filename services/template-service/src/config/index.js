'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.TEMPLATE_SERVICE_PORT || '3006', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  meta: {
    apiVersion: process.env.META_API_VERSION || 'v20.0',
    baseUrl: process.env.META_API_BASE_URL || 'https://graph.facebook.com/v20.0',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003',
  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3009',
  templateCacheTtl: 300, // 5 minutes in seconds
};
