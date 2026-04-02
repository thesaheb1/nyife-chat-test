'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.CAMPAIGN_SERVICE_PORT || '3007', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003',
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3004',
  contactServiceUrl: process.env.CONTACT_SERVICE_URL || 'http://localhost:3005',
  templateServiceUrl: process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3006',
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL || 'http://localhost:3017',
  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3009',
};
