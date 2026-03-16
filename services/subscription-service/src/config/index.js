'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.SUBSCRIPTION_SERVICE_PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  walletServiceUrl: process.env.WALLET_SERVICE_URL || 'http://localhost:3004',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  tax: {
    type: process.env.TAX_TYPE || 'GST',
    rate: parseInt(process.env.TAX_RATE || '18', 10),
    inclusive: process.env.TAX_INCLUSIVE === 'true',
  },
  renewal: {
    gracePeriodMs: parseInt(process.env.SUBSCRIPTION_RENEWAL_GRACE_PERIOD_MS || String(3 * 24 * 60 * 60 * 1000), 10),
    retryIntervalMs: parseInt(process.env.SUBSCRIPTION_RENEWAL_RETRY_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10),
    batchSize: parseInt(process.env.SUBSCRIPTION_RENEWAL_BATCH_SIZE || '100', 10),
  },
};
