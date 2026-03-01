'use strict';

const { z } = require('zod');

const uuidField = z.string().uuid();
const timestampField = z.string();

/**
 * Schema for campaign.execute events.
 * Producer: campaign-service | Consumer: whatsapp-service
 */
const campaignExecuteSchema = z.object({
  campaignId: uuidField,
  userId: uuidField,
  contactId: uuidField,
  phoneNumber: z.string(),
  templateName: z.string(),
  templateLanguage: z.string(),
  components: z.array(z.any()).optional(),
  messageType: z.enum(['template', 'text']).default('template'),
  textContent: z.string().optional(),
});

/**
 * Schema for campaign.status events.
 * Producer: whatsapp-service | Consumer: campaign-service
 */
const campaignStatusSchema = z.object({
  campaignId: uuidField,
  contactId: uuidField,
  messageId: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: timestampField,
  errorCode: z.number().optional(),
  errorMessage: z.string().optional(),
});

/**
 * Schema for campaign.analytics events.
 * Producer: whatsapp-service | Consumer: analytics-service
 */
const campaignAnalyticsSchema = z.object({
  campaignId: uuidField,
  userId: uuidField,
  messageId: z.string(),
  status: z.string(),
  timestamp: timestampField,
  conversationType: z.string().optional(),
  pricingCategory: z.string().optional(),
});

/**
 * Schema for notification.send events.
 * Producer: any service | Consumer: notification-service
 */
const notificationSendSchema = z.object({
  userId: uuidField,
  type: z.enum(['in_app', 'email', 'push']),
  title: z.string(),
  body: z.string(),
  data: z.record(z.any()).optional(),
  channel: z.string().optional(),
});

/**
 * Schema for email.send events.
 * Producer: any service | Consumer: email-service
 */
const emailSendSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  template: z.string().optional(),
  templateData: z.record(z.any()).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
});

/**
 * Schema for webhook.inbound events.
 * Producer: whatsapp-service | Consumer: chat-service, automation-service
 */
const webhookInboundSchema = z.object({
  wabaId: z.string(),
  phoneNumberId: z.string(),
  event: z.any(),
  eventType: z.enum(['message', 'status', 'template_status', 'phone_quality', 'account_update']),
  timestamp: timestampField,
});

/**
 * Schema for wallet.transaction events.
 * Producer: wallet-service | Consumer: analytics-service
 */
const walletTransactionSchema = z.object({
  userId: uuidField,
  amount: z.number().int(),
  type: z.enum(['credit', 'debit']),
  description: z.string(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
});

/**
 * Schema for user.events events.
 * Producer: auth-service | Consumer: analytics-service, notification-service
 */
const userEventsSchema = z.object({
  userId: uuidField,
  event: z.enum(['registered', 'verified', 'login', 'profile_updated', 'suspended', 'deleted']),
  data: z.record(z.any()).optional(),
  timestamp: timestampField,
});

/**
 * Map of topic names to their validation schemas.
 */
const TOPIC_SCHEMAS = {
  'campaign.execute': campaignExecuteSchema,
  'campaign.status': campaignStatusSchema,
  'campaign.analytics': campaignAnalyticsSchema,
  'notification.send': notificationSendSchema,
  'email.send': emailSendSchema,
  'webhook.inbound': webhookInboundSchema,
  'wallet.transaction': walletTransactionSchema,
  'user.events': userEventsSchema,
};

module.exports = {
  campaignExecuteSchema,
  campaignStatusSchema,
  campaignAnalyticsSchema,
  notificationSendSchema,
  emailSendSchema,
  webhookInboundSchema,
  walletTransactionSchema,
  userEventsSchema,
  TOPIC_SCHEMAS,
};
