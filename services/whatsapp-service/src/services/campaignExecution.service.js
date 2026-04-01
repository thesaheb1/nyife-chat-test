'use strict';

const { TOPICS, publishEvent } = require('@nyife/shared-events');
const { WaAccount } = require('../models');
const messageService = require('./message.service');

function buildCampaignStatusEvent(payload, status, options = {}) {
  return {
    campaignId: payload.campaignId,
    userId: payload.userId,
    contactId: payload.contactId || payload.phoneNumber,
    messageId: options.messageId || '',
    status,
    timestamp: options.timestamp || new Date().toISOString(),
    errorCode: options.errorCode,
    errorMessage: options.errorMessage,
  };
}

async function publishCampaignStatus(kafkaProducer, payload, status, options = {}, publishEventFn = publishEvent) {
  if (!kafkaProducer || !payload?.campaignId) {
    return null;
  }

  const eventPayload = buildCampaignStatusEvent(payload, status, options);
  await publishEventFn(kafkaProducer, TOPICS.CAMPAIGN_STATUS, payload.campaignId, eventPayload);
  return eventPayload;
}

async function publishWhatsAppMessageStatus(
  kafkaProducer,
  payload,
  status,
  {
    accountLookup = async (userId, waAccountId) => WaAccount.findOne({
      where: {
        id: waAccountId,
        user_id: userId,
      },
    }),
    publishEventFn = publishEvent,
    messageId = '',
    timestamp = new Date().toISOString(),
  } = {}
) {
  if (!kafkaProducer || !payload?.userId || !payload?.waAccountId || !payload?.phoneNumber || !messageId) {
    return null;
  }

  const account = await accountLookup(payload.userId, payload.waAccountId);
  if (!account) {
    return null;
  }

  const eventPayload = {
    userId: account.user_id,
    waAccountId: account.id,
    wabaId: String(account.waba_id || ''),
    phoneNumberId: String(account.phone_number_id || ''),
    metaMessageId: messageId,
    contactPhone: payload.phoneNumber,
    status,
    campaignId: payload.campaignId || undefined,
    timestamp,
  };

  await publishEventFn(kafkaProducer, TOPICS.WHATSAPP_MESSAGE_STATUS, messageId, eventPayload);
  return eventPayload;
}

async function processCampaignExecuteMessage(
  payload,
  {
    kafkaProducer = null,
    sendCampaignMessage = messageService.sendCampaignMessage,
    publishEventFn = publishEvent,
    accountLookup,
    logger = console,
  } = {}
) {
  try {
    const result = await sendCampaignMessage({
      userId: payload.userId,
      waAccountId: payload.waAccountId,
      phoneNumber: payload.phoneNumber,
      campaignId: payload.campaignId,
      templateName: payload.templateName,
      templateLanguage: payload.templateLanguage,
      templateCategory: payload.templateCategory,
      components: payload.components || [],
      messageType: payload.messageType || 'template',
      textContent: payload.textContent,
    });

    try {
      await publishCampaignStatus(
        kafkaProducer,
        payload,
        'queued',
        {
          messageId: result?.meta_message_id || '',
        },
        publishEventFn
      );
    } catch (publishError) {
      logger.error('[whatsapp-service] Failed to publish immediate campaign queued status:', publishError.message);
    }

    try {
      await publishWhatsAppMessageStatus(
        kafkaProducer,
        payload,
        'queued',
        {
          accountLookup,
          publishEventFn,
          messageId: result?.meta_message_id || '',
        }
      );
    } catch (publishError) {
      logger.error('[whatsapp-service] Failed to publish immediate WhatsApp queued status:', publishError.message);
    }

    return result;
  } catch (err) {
    try {
      await publishCampaignStatus(
        kafkaProducer,
        payload,
        'failed',
        {
          errorCode: 0,
          errorMessage: err.message,
        },
        publishEventFn
      );
    } catch (publishError) {
      logger.error('[whatsapp-service] Failed to publish immediate campaign failure status:', publishError.message);
    }

    throw err;
  }
}

module.exports = {
  processCampaignExecuteMessage,
  __private: {
    buildCampaignStatusEvent,
    publishCampaignStatus,
    publishWhatsAppMessageStatus,
  },
};
