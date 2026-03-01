'use strict';

const { TOPICS, ALL_TOPICS } = require('./topics');
const {
  campaignExecuteSchema,
  campaignStatusSchema,
  campaignAnalyticsSchema,
  notificationSendSchema,
  emailSendSchema,
  webhookInboundSchema,
  walletTransactionSchema,
  userEventsSchema,
  TOPIC_SCHEMAS,
} = require('./schemas');
const { publishEvent } = require('./producer');
const { createEventConsumer } = require('./consumer');

module.exports = {
  TOPICS,
  ALL_TOPICS,
  campaignExecuteSchema,
  campaignStatusSchema,
  campaignAnalyticsSchema,
  notificationSendSchema,
  emailSendSchema,
  webhookInboundSchema,
  walletTransactionSchema,
  userEventsSchema,
  TOPIC_SCHEMAS,
  publishEvent,
  createEventConsumer,
};
