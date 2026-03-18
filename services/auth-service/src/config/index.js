'use strict';

require('dotenv').config();

const { resolveFrontendAppUrl } = require('@nyife/shared-utils');

module.exports = {
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/google/callback',
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET,
      callbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/facebook/callback',
    },
  },
  frontendUrl: resolveFrontendAppUrl(process.env),
  emailServiceUrl: process.env.EMAIL_SERVICE_URL || 'http://localhost:3013',
  userCacheTtl: 900, // 15 minutes in seconds
};
