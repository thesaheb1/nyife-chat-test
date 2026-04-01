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
  waAccountId: uuidField,
  contactId: uuidField,
  phoneNumber: z.string(),
  templateName: z.string(),
  templateLanguage: z.string(),
  templateCategory: z.string().optional(),
  components: z.array(z.any()).optional(),
  messageType: z.enum(['template', 'text']).default('template'),
  textContent: z.string().optional(),
});



/**
 * Schema for campaign.status events.
 * Producer: whatsapp-service | Consumer: campaign-service
 */
const campaignStatusSchema = z.object({
  campaignId: z.string(),
  userId: uuidField.optional(),
  contactId: z.string(),
  messageId: z.string(),
  status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed']),
  timestamp: timestampField,
  errorCode: z.number().optional(),
  errorMessage: z.string().optional(),
});

const campaignLiveSchema = z.object({
  campaignId: z.string(),
  userId: uuidField.optional(),
  organizationId: uuidField.optional(),
  messageId: z.string().optional(),
  status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed']),
  timestamp: timestampField,
  stats: z.object({
    total_recipients: z.number().int().nonnegative(),
    sent_count: z.number().int().nonnegative(),
    delivered_count: z.number().int().nonnegative(),
    read_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    pending_count: z.number().int().nonnegative(),
    status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled']),
  }),
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
 * Schema for inbound WhatsApp message events.
 * Producer: whatsapp-service | Consumer: chat-service, automation-service, analytics-service
 */
const webhookInboundSchema = z.object({
  userId: uuidField,
  waAccountId: uuidField,
  wabaId: z.string(),
  phoneNumberId: z.string(),
  message: z.any(),
  contacts: z.array(z.any()).default([]),
  eventType: z.literal('message'),
  timestamp: timestampField,
});

/**
 * Schema for WhatsApp message status events.
 * Producer: whatsapp-service | Consumer: chat-service
 */
const whatsappMessageStatusSchema = z.object({
  userId: uuidField,
  waAccountId: uuidField,
  wabaId: z.string(),
  phoneNumberId: z.string(),
  metaMessageId: z.string(),
  contactPhone: z.string().optional(),
  status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed']),
  pricingModel: z.string().optional(),
  pricingCategory: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  campaignId: z.string().optional(),
  timestamp: timestampField,
});

/**
 * Schema for WhatsApp template status events.
 * Producer: whatsapp-service | Consumer: template-service
 */
const whatsappTemplateStatusSchema = z.object({
  userId: uuidField.nullable().optional(),
  waAccountId: uuidField.nullable().optional(),
  wabaId: z.string(),
  phoneNumberId: z.string().nullable().optional(),
  messageTemplateId: z.string().nullable().optional(),
  messageTemplateName: z.string(),
  messageTemplateLanguage: z.string().nullable().optional(),
  status: z.string(),
  reason: z.string().nullable().optional(),
  timestamp: timestampField,
});

/**
 * Schema for WhatsApp account lifecycle events.
 * Producer: whatsapp-service | Consumer: frontend-facing services, automation-service
 */
const whatsappAccountLifecycleSchema = z.object({
  userId: uuidField,
  waAccountId: uuidField,
  wabaId: z.string(),
  phoneNumberId: z.string(),
  lifecycleType: z.enum([
    'quality_update',
    'account_update',
    'onboarding_completed',
    'onboarding_failed',
    'reconciled',
    'health_check',
    'disconnected',
  ]),
  accountStatus: z.string().optional(),
  onboardingStatus: z.string().optional(),
  qualityRating: z.string().nullable().optional(),
  messagingLimit: z.string().nullable().optional(),
  appSubscriptionStatus: z.string().nullable().optional(),
  creditSharingStatus: z.string().nullable().optional(),
  steps: z.array(z.any()).optional(),
  error: z.string().nullable().optional(),
  timestamp: timestampField,
});

/**
 * Schema for whatsapp.flow.completed events.
 * Producer: whatsapp-service | Consumer: template-service, automation-service
 */
const whatsappFlowCompletedSchema = z.object({
  userId: uuidField,
  waAccountId: uuidField,
  wabaId: z.string(),
  phoneNumberId: z.string(),
  metaFlowId: z.string(),
  flowToken: z.string().optional(),
  screenId: z.string().optional(),
  contactPhone: z.string(),
  payload: z.record(z.any()),
  rawMessage: z.any(),
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
  source: z.string(),
  balanceAfter: z.number().int().optional(),
  transactionId: z.string().optional(),
  invoiceId: z.string().optional(),
  paymentId: z.string().optional(),
  description: z.string(),
  referenceId: z.string().optional(),
  referenceType: z.string().optional(),
  meta: z.record(z.any()).optional(),
  timestamp: timestampField.optional(),
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

const supportEventSchema = z.object({
  ticketId: uuidField,
  ticketNumber: z.string(),
  organizationId: uuidField,
  userId: uuidField.optional(),
  actorId: uuidField.optional(),
  actorType: z.enum(['user', 'admin']).optional(),
  assignedTo: uuidField.optional(),
  messageId: uuidField.optional(),
  replyType: z.enum(['user', 'admin', 'system']).optional(),
  status: z.enum(['open', 'in_progress', 'waiting_on_user', 'resolved', 'closed']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  deletedBy: uuidField.optional(),
  timestamp: timestampField,
});

/**
 * Map of topic names to their validation schemas.
 */
const TOPIC_SCHEMAS = {
  'campaign.execute': campaignExecuteSchema,
  'campaign.status': campaignStatusSchema,
  'campaign.live': campaignLiveSchema,
  'campaign.analytics': campaignAnalyticsSchema,
  'notification.send': notificationSendSchema,
  'email.send': emailSendSchema,
  'webhook.inbound': webhookInboundSchema,
  'whatsapp.message.status': whatsappMessageStatusSchema,
  'whatsapp.template.status': whatsappTemplateStatusSchema,
  'whatsapp.account.lifecycle': whatsappAccountLifecycleSchema,
  'whatsapp.flow.completed': whatsappFlowCompletedSchema,
  'wallet.transaction': walletTransactionSchema,
  'user.events': userEventsSchema,
  'support.ticket.created': supportEventSchema,
  'support.message.created': supportEventSchema,
  'support.ticket.assigned': supportEventSchema,
  'support.ticket.status.updated': supportEventSchema,
  'support.ticket.deleted': supportEventSchema,
  'support.ticket.rated': supportEventSchema,
};

module.exports = {
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
};
