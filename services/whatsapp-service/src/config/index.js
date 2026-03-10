'use strict';

require('dotenv').config();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

module.exports = {
  port: parseInt(process.env.WHATSAPP_SERVICE_PORT || '3009', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    apiVersion: process.env.META_API_VERSION || 'v20.0',
    baseUrl: process.env.META_API_BASE_URL || 'https://graph.facebook.com/v20.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'nyife_webhook_verify',
    systemUserAccessToken: process.env.META_SYSTEM_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || null,
    systemUserId: process.env.META_SYSTEM_USER_ID || null,
    providerBusinessId: process.env.META_PROVIDER_BUSINESS_ID || process.env.META_BUSINESS_ID || null,
    overrideCallbackUrl: process.env.META_OVERRIDE_CALLBACK_URL || null,
    creditLineId: process.env.META_CREDIT_LINE_ID || null,
    creditLineCurrency: process.env.META_CREDIT_LINE_CURRENCY || 'INR',
    enableCreditSharing: parseBoolean(process.env.META_ENABLE_CREDIT_SHARING, false),
    allowLegacyAccountTokenFallback: parseBoolean(
      process.env.META_ALLOW_LEGACY_ACCOUNT_TOKEN_FALLBACK,
      true
    ),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    requiredForSignup: parseBoolean(
      process.env.META_REQUIRE_REDIS_FOR_SIGNUP,
      false
    ),
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003',
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3004',
  templateServiceUrl: process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3006',
  organizationServiceUrl: process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:3011',
};
