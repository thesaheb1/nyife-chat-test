'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.WHATSAPP_SERVICE_PORT || '3009', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    apiVersion: process.env.META_API_VERSION || 'v20.0',
    baseUrl: process.env.META_API_BASE_URL || 'https://graph.facebook.com/v20.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'nyife_webhook_verify',
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
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3004',
  templateServiceUrl: process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3006',
};
