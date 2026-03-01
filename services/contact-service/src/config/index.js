'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.CONTACT_SERVICE_PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  subscriptionServiceUrl: process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003',
  csvUploadMaxSizeMb: parseInt(process.env.CSV_UPLOAD_MAX_SIZE_MB || '10', 10),
};
