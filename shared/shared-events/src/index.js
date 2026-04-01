'use strict';

const { TOPICS, ALL_TOPICS } = require('./topics');
const {
  campaignExecuteSchema,
  campaignStatusSchema,
  campaignLiveSchema,
  campaignAnalyticsSchema,
  notificationSendSchema,
  emailSendSchema,
  webhookInboundSchema,
  whatsappMessageStatusSchema,
  whatsappTemplateStatusSchema,
  whatsappAccountLifecycleSchema,
  whatsappFlowCompletedSchema,
  walletTransactionSchema,
  userEventsSchema,
  supportEventSchema,
  TOPIC_SCHEMAS,
} = require('./schemas');
const { publishEvent } = require('./producer');
const { createEventConsumer } = require('./consumer');

module.exports = {
  TOPICS,
  ALL_TOPICS,
  campaignExecuteSchema,
  campaignStatusSchema,
  campaignLiveSchema,
  campaignAnalyticsSchema,
  notificationSendSchema,
  emailSendSchema,
  webhookInboundSchema,
  whatsappMessageStatusSchema,
  whatsappTemplateStatusSchema,
  whatsappAccountLifecycleSchema,
  whatsappFlowCompletedSchema,
  walletTransactionSchema,
  userEventsSchema,
  supportEventSchema,
  TOPIC_SCHEMAS,
  publishEvent,
  createEventConsumer,
};
