'use strict';

require('dotenv').config();
const { resolveFrontendAppUrl } = require('@nyife/shared-utils');

module.exports = {
  port: parseInt(process.env.ADMIN_SERVICE_PORT || '3015', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3002',
  subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003',
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3004',
  emailServiceUrl: process.env.EMAIL_SERVICE_URL || 'http://localhost:3013',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3012',
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL || 'http://localhost:3017',
  frontendUrl: resolveFrontendAppUrl(process.env),
};
