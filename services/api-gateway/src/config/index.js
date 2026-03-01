'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.API_GATEWAY_PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    subscription: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003',
    wallet: process.env.WALLET_SERVICE_URL || 'http://localhost:3004',
    contact: process.env.CONTACT_SERVICE_URL || 'http://localhost:3005',
    template: process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3006',
    campaign: process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3007',
    chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3008',
    whatsapp: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3009',
    automation: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3010',
    organization: process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:3011',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3012',
    email: process.env.EMAIL_SERVICE_URL || 'http://localhost:3013',
    support: process.env.SUPPORT_SERVICE_URL || 'http://localhost:3014',
    admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:3015',
    analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3016',
    media: process.env.MEDIA_SERVICE_URL || 'http://localhost:3017',
  },
  rateLimit: {
    global: { windowMs: 60000, max: 100 },
    auth: { windowMs: 60000, max: 10 },
  },
};
