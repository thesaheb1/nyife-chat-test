'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.AUTOMATION_SERVICE_PORT || '3010', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3009',
  contactServiceUrl: process.env.CONTACT_SERVICE_URL || 'http://localhost:3005',
};
