'use strict';

/**
 * Kafka topic name constants for all Nyife microservices.
 */
const TOPICS = {
  CAMPAIGN_EXECUTE: 'campaign.execute',
  CAMPAIGN_STATUS: 'campaign.status',
  CAMPAIGN_ANALYTICS: 'campaign.analytics',
  NOTIFICATION_SEND: 'notification.send',
  EMAIL_SEND: 'email.send',
  WEBHOOK_INBOUND: 'webhook.inbound',
  WHATSAPP_MESSAGE_STATUS: 'whatsapp.message.status',
  WHATSAPP_TEMPLATE_STATUS: 'whatsapp.template.status',
  WHATSAPP_ACCOUNT_LIFECYCLE: 'whatsapp.account.lifecycle',
  WHATSAPP_FLOW_COMPLETED: 'whatsapp.flow.completed',
  WALLET_TRANSACTION: 'wallet.transaction',
  USER_EVENTS: 'user.events',
};

/**
 * List of all topics for creation scripts.
 */
const ALL_TOPICS = Object.values(TOPICS);

module.exports = { TOPICS, ALL_TOPICS };
