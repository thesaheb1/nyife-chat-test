'use strict';

const { createDatabase, testConnection } = require('./database');
const { createRedisClient } = require('./redis');
const {
  createKafkaClient,
  createKafkaProducer,
  createKafkaProducerWithRetry,
  createKafkaConsumer,
  createKafkaConsumerWithRetry,
} = require('./kafka');
const {
  USER_ROLES,
  ADMIN_ROLES,
  USER_STATUS,
  MESSAGE_TYPES,
  TEMPLATE_TYPES,
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORIES,
  PLAN_TYPES,
  SUBSCRIPTION_STATUS,
  CAMPAIGN_STATUS,
  MESSAGE_STATUS,
  TICKET_STATUS,
  TRANSACTION_TYPES,
  NOTIFICATION_TYPES,
  CHAT_ASSIGNMENT_STATUS,
  WEBHOOK_EVENTS,
} = require('./constants');

module.exports = {
  // Database
  createDatabase,
  testConnection,

  // Redis
  createRedisClient,

  // Kafka
  createKafkaClient,
  createKafkaProducer,
  createKafkaProducerWithRetry,
  createKafkaConsumer,
  createKafkaConsumerWithRetry,

  // Constants
  USER_ROLES,
  ADMIN_ROLES,
  USER_STATUS,
  MESSAGE_TYPES,
  TEMPLATE_TYPES,
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORIES,
  PLAN_TYPES,
  SUBSCRIPTION_STATUS,
  CAMPAIGN_STATUS,
  MESSAGE_STATUS,
  TICKET_STATUS,
  TRANSACTION_TYPES,
  NOTIFICATION_TYPES,
  CHAT_ASSIGNMENT_STATUS,
  WEBHOOK_EVENTS,
};
