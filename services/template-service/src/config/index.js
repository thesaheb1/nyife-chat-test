'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// When the service is started from its own folder, dotenv loads
// services/template-service/.env. Backfill any missing shared vars
// from the repo root .env without overwriting existing process env.
const rootEnvPath = path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(rootEnvPath)) {
  const parsedRootEnv = dotenv.parse(fs.readFileSync(rootEnvPath));
  for (const [key, value] of Object.entries(parsedRootEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  port: parseInt(process.env.TEMPLATE_SERVICE_PORT || '3006', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  meta: {
    apiVersion: process.env.META_API_VERSION || 'v20.0',
    baseUrl: process.env.META_API_BASE_URL || 'https://graph.facebook.com/v20.0',
    systemUserAccessToken:
      process.env.META_SYSTEM_USER_ACCESS_TOKEN
      || process.env.META_ACCESS_TOKEN
      || null,
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
  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000',
  frontendBaseUrl: process.env.FRONTEND_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  templateCacheTtl: 300, // 5 minutes in seconds
};
