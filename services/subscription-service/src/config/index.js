'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.SUBSCRIPTION_SERVICE_PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  tax: {
    type: process.env.TAX_TYPE || 'GST',
    rate: parseInt(process.env.TAX_RATE || '18', 10),
    inclusive: process.env.TAX_INCLUSIVE === 'true',
  },
};
