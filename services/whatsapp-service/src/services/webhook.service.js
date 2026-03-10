'use strict';

const { WaAccount, WaMessage } = require('../models');
const { AppError } = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const accountService = require('./account.service');
const messageService = require('./message.service');
const config = require('../config');

/**
 * Verifies the webhook subscription from Meta.
 *
 * Meta sends a GET request with hub.mode, hub.verify_token, and hub.challenge.
 * We verify the mode is "subscribe" and the token matches, then return the challenge.
 *
 * @param {object} query - The parsed query parameters
 * @returns {string} The hub.challenge value to return to Meta
 */
function verifyWebhook(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode !== 'subscribe') {
    throw AppError.badRequest('Invalid hub.mode — expected "subscribe"');
  }

  if (token !== config.meta.webhookVerifyToken) {
    throw AppError.unauthorized('Invalid webhook verify token');
  }

  return challenge;
}

/**
 * Processes an incoming webhook payload from Meta WhatsApp Cloud API.
 *
 * The webhook payload structure (envelope):
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [{
 *     "id": "WABA_ID",
 *     "changes": [{
 *       "value": { ... },
 *       "field": "messages" | "message_template_status_update" | ...
 *     }]
 *   }]
 * }
 *
 * Processing is async — the controller already responded 200 before calling this.
 *
 * @param {object} body - The parsed webhook body
 * @param {object|null} kafkaProducer - The Kafka producer instance (may be null)
 */
async function processWebhook(body, kafkaProducer) {
  if (!body || body.object !== 'whatsapp_business_account') {
    console.warn('[whatsapp-service] Webhook received non-WABA object:', body?.object);
    return;
  }

  const entries = body.entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    console.warn('[whatsapp-service] Webhook received empty entry array');
    return;
  }

  for (const entry of entries) {
    const wabaId = entry.id;
    const changes = entry.changes;

    if (!Array.isArray(changes) || changes.length === 0) {
      continue;
    }

    for (const change of changes) {
      const field = change.field;
      const value = change.value;

      if (!value) {
        continue;
      }

      try {
        switch (field) {
          case 'messages':
            await handleMessagesField(wabaId, value, kafkaProducer);
            break;

          case 'message_template_status_update':
            await handleTemplateStatusUpdate(wabaId, value, kafkaProducer);
            break;

          case 'phone_number_quality_update':
            await handlePhoneQualityUpdate(wabaId, value, kafkaProducer);
            break;

          case 'account_update':
            await handleAccountUpdate(wabaId, value, kafkaProducer);
            break;

          default:
            console.log(
              `[whatsapp-service] Unhandled webhook field "${field}" for WABA ${wabaId}`
            );
            break;
        }
      } catch (err) {
        console.error(
          `[whatsapp-service] Error processing webhook field "${field}" for WABA ${wabaId}:`,
          err.message
        );
      }
    }
  }
}

/**
 * Handles the "messages" field in a webhook change.
 * Contains incoming messages and/or status updates.
 *
 * @param {string} wabaId - The WABA ID from the entry
 * @param {object} value - The change value object
 * @param {object|null} kafkaProducer - Kafka producer
 */
async function handleMessagesField(wabaId, value, kafkaProducer) {
  const metadata = value.metadata || {};
  const phoneNumberId = metadata.phone_number_id;
  const displayPhone = metadata.display_phone_number;

  // Find the WA account by phone_number_id
  let account = null;
  if (phoneNumberId) {
    account = await accountService.findByPhoneNumberId(phoneNumberId);
  }

  // Process incoming messages
  if (value.messages && Array.isArray(value.messages)) {
    for (const msg of value.messages) {
      await handleIncomingMessage(account, wabaId, phoneNumberId, displayPhone, msg, value.contacts, kafkaProducer);
    }
  }

  // Process status updates
  if (value.statuses && Array.isArray(value.statuses)) {
    for (const statusUpdate of value.statuses) {
      await handleStatusUpdate(account, wabaId, phoneNumberId, statusUpdate, kafkaProducer);
    }
  }
}

/**
 * Handles a single incoming message from a webhook.
 * Creates a wa_messages record and publishes to Kafka.
 *
 * @param {object|null} account - WaAccount record (if found)
 * @param {string} wabaId - WABA ID
 * @param {string} phoneNumberId - Phone number ID
 * @param {string} displayPhone - Display phone number
 * @param {object} msg - Message object from Meta webhook
 * @param {Array} contacts - Contacts array from webhook (contains name info)
 * @param {object|null} kafkaProducer - Kafka producer
 */
async function handleIncomingMessage(account, wabaId, phoneNumberId, displayPhone, msg, contacts, kafkaProducer) {
  const from = msg.from; // Sender phone number
  const messageId = msg.id; // Meta message ID (wamid)
  const timestamp = msg.timestamp;
  const type = msg.type || 'unknown';

  // Extract message content based on type
  const content = extractMessageContent(msg);

  // Extract contact name if available
  const contactInfo = contacts?.find((c) => c.wa_id === from);
  if (contactInfo) {
    content._contact_name = contactInfo.profile?.name || null;
  }

  // Create wa_messages record if we found the account
  if (account) {
    try {
      await WaMessage.create({
        user_id: account.user_id,
        wa_account_id: account.id,
        contact_phone: from,
        direction: 'inbound',
        type,
        content,
        meta_message_id: messageId,
        status: 'delivered', // Inbound messages are already delivered to us
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to store inbound message:',
        err.message
      );
    }
  }

  // Publish to Kafka for chat-service and automation-service
  if (kafkaProducer && account?.id && account?.user_id) {
    try {
      await publishEvent(kafkaProducer, TOPICS.WEBHOOK_INBOUND, wabaId, {
        userId: account.user_id,
        waAccountId: account.id,
        wabaId: String(wabaId),
        phoneNumberId: String(phoneNumberId),
        message: msg,
        contacts: contacts || [],
        eventType: 'message',
        timestamp: timestamp
          ? new Date(parseInt(timestamp, 10) * 1000).toISOString()
          : new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to publish inbound message to Kafka:',
        err.message
      );
    }
  }

  const flowCompletion = await resolveFlowCompletion(msg, account);
  if (flowCompletion && kafkaProducer && account?.user_id) {
    try {
      await publishEvent(kafkaProducer, TOPICS.WHATSAPP_FLOW_COMPLETED, flowCompletion.metaFlowId, {
        userId: account.user_id,
        waAccountId: account.id,
        wabaId: String(wabaId),
        phoneNumberId: String(phoneNumberId),
        metaFlowId: flowCompletion.metaFlowId,
        flowToken: flowCompletion.flowToken || undefined,
        screenId: flowCompletion.screenId || undefined,
        contactPhone: from,
        payload: flowCompletion.payload || {},
        rawMessage: msg,
        timestamp: timestamp
          ? new Date(parseInt(timestamp, 10) * 1000).toISOString()
          : new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to publish flow completion to Kafka:',
        err.message
      );
    }
  }
}

/**
 * Extracts message content from a Meta webhook message object for storage.
 *
 * @param {object} msg - Raw message from webhook
 * @returns {object} Extracted content
 */
function extractMessageContent(msg) {
  const type = msg.type || 'unknown';

  switch (type) {
    case 'text':
      return { body: msg.text?.body || '' };

    case 'image':
      return {
        media_id: msg.image?.id || null,
        mime_type: msg.image?.mime_type || null,
        sha256: msg.image?.sha256 || null,
        caption: msg.image?.caption || null,
      };

    case 'video':
      return {
        media_id: msg.video?.id || null,
        mime_type: msg.video?.mime_type || null,
        sha256: msg.video?.sha256 || null,
        caption: msg.video?.caption || null,
      };

    case 'audio':
      return {
        media_id: msg.audio?.id || null,
        mime_type: msg.audio?.mime_type || null,
        sha256: msg.audio?.sha256 || null,
        voice: msg.audio?.voice || false,
      };

    case 'document':
      return {
        media_id: msg.document?.id || null,
        mime_type: msg.document?.mime_type || null,
        sha256: msg.document?.sha256 || null,
        filename: msg.document?.filename || null,
        caption: msg.document?.caption || null,
      };

    case 'sticker':
      return {
        media_id: msg.sticker?.id || null,
        mime_type: msg.sticker?.mime_type || null,
        sha256: msg.sticker?.sha256 || null,
        animated: msg.sticker?.animated || false,
      };

    case 'location':
      return {
        latitude: msg.location?.latitude || null,
        longitude: msg.location?.longitude || null,
        name: msg.location?.name || null,
        address: msg.location?.address || null,
      };

    case 'contacts':
      return { contacts: msg.contacts || [] };

    case 'reaction':
      return {
        message_id: msg.reaction?.message_id || null,
        emoji: msg.reaction?.emoji || null,
      };

    case 'interactive':
      return {
        interactive_type: msg.interactive?.type || null,
        button_reply: msg.interactive?.button_reply || null,
        list_reply: msg.interactive?.list_reply || null,
        nfm_reply: msg.interactive?.nfm_reply || null,
        flow_payload: extractFlowCompletionPayload(msg),
      };

    case 'button':
      return {
        text: msg.button?.text || null,
        payload: msg.button?.payload || null,
      };

    case 'order':
      return {
        catalog_id: msg.order?.catalog_id || null,
        product_items: msg.order?.product_items || [],
        text: msg.order?.text || null,
      };

    case 'referral':
      return {
        source_url: msg.referral?.source_url || null,
        source_type: msg.referral?.source_type || null,
        source_id: msg.referral?.source_id || null,
        headline: msg.referral?.headline || null,
        body: msg.referral?.body || null,
        media_type: msg.referral?.media_type || null,
        media_url: msg.referral?.media_url || null,
      };

    default:
      // Store the raw message for unknown types
      return { raw: msg[type] || msg };
  }
}

function parsePossiblyJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function extractFlowCompletionPayload(msg) {
  const interactive = msg?.interactive || {};
  if (interactive.type !== 'nfm_reply' && !interactive.nfm_reply) {
    return null;
  }

  const nfmReply = interactive.nfm_reply || {};
  const responseJson = parsePossiblyJson(
    nfmReply.response_json
    || interactive.response_json
    || null
  );

  return {
    name: nfmReply.name || null,
    body: nfmReply.body || null,
    flow_token: nfmReply.flow_token || responseJson?.flow_token || null,
    screen_id: nfmReply.screen_id || responseJson?.screen_id || responseJson?.screen || null,
    flow_id: nfmReply.flow_id || responseJson?.flow_id || responseJson?.meta_flow_id || null,
    response_json: responseJson,
  };
}

async function resolveFlowCompletion(msg, account) {
  const payload = extractFlowCompletionPayload(msg);
  if (!payload) {
    return null;
  }

  let metaFlowId = payload.flow_id || null;
  let localFlowId = null;

  if ((!metaFlowId || !payload.flow_token) && msg.context?.id && account?.id) {
    try {
      const parentMessage = await WaMessage.findOne({
        where: {
          meta_message_id: msg.context.id,
          wa_account_id: account.id,
        },
      });

      const parentContent = parentMessage?.content || {};
      const linkedFlows = Array.isArray(parentContent.linked_flows)
        ? parentContent.linked_flows
        : [];

      if (!metaFlowId) {
        metaFlowId = parentContent.meta_flow_id || linkedFlows[0]?.meta_flow_id || null;
      }
      if (!localFlowId) {
        localFlowId = parentContent.local_flow_id || linkedFlows[0]?.local_flow_id || null;
      }
      if (!payload.flow_token) {
        payload.flow_token = parentContent.flow_token || null;
      }
    } catch (err) {
      console.warn('[whatsapp-service] Could not resolve parent flow message context:', err.message);
    }
  }

  if (!metaFlowId) {
    return null;
  }

  return {
    metaFlowId,
    localFlowId,
    flowToken: payload.flow_token || null,
    screenId: payload.screen_id || null,
    payload: payload.response_json && typeof payload.response_json === 'object'
      ? payload.response_json
      : {},
  };
}

/**
 * Handles a single status update from a webhook.
 * Updates the wa_messages record and publishes to Kafka for campaign tracking.
 *
 * @param {object|null} account - WaAccount record (if found)
 * @param {string} wabaId - WABA ID
 * @param {string} phoneNumberId - Phone number ID
 * @param {object} statusUpdate - Status update object from Meta webhook
 * @param {object|null} kafkaProducer - Kafka producer
 */
async function handleStatusUpdate(account, wabaId, phoneNumberId, statusUpdate, kafkaProducer) {
  const messageId = statusUpdate.id; // Meta message ID (wamid)
  const status = statusUpdate.status; // sent, delivered, read, failed
  const timestamp = statusUpdate.timestamp;
  const recipientId = statusUpdate.recipient_id;

  // Extract error info if failed
  let errorInfo = null;
  if (status === 'failed' && statusUpdate.errors && statusUpdate.errors.length > 0) {
    const err = statusUpdate.errors[0];
    errorInfo = {
      code: err.code,
      message: err.title || err.message || 'Unknown error',
    };
  }

  // Extract pricing info
  let pricingInfo = null;
  if (statusUpdate.pricing) {
    pricingInfo = {
      pricing_model: statusUpdate.pricing.pricing_model || null,
      category: statusUpdate.pricing.category || null,
      billable: typeof statusUpdate.pricing.billable === 'boolean'
        ? statusUpdate.pricing.billable
        : null,
    };
  }

  // Conversation info
  const conversationInfo = statusUpdate.conversation || null;

  // Update message record
  const updatedMessage = await messageService.updateMessageStatus(
    messageId,
    status,
    errorInfo,
    pricingInfo
  );

  // If this message is part of a campaign, publish to campaign.status
  if (updatedMessage && updatedMessage.campaign_id && kafkaProducer) {
    try {
      await publishEvent(kafkaProducer, TOPICS.CAMPAIGN_STATUS, updatedMessage.campaign_id, {
        campaignId: updatedMessage.campaign_id,
        contactId: recipientId || updatedMessage.contact_phone,
        messageId: messageId,
        status,
        timestamp: timestamp
          ? new Date(parseInt(timestamp, 10) * 1000).toISOString()
          : new Date().toISOString(),
        errorCode: errorInfo ? Number(errorInfo.code) || 0 : undefined,
        errorMessage: errorInfo ? errorInfo.message : undefined,
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to publish campaign status to Kafka:',
        err.message
      );
    }
  }

  // Publish to campaign.analytics for all messages with campaign_id
  if (updatedMessage && updatedMessage.campaign_id && kafkaProducer) {
    try {
      await publishEvent(kafkaProducer, TOPICS.CAMPAIGN_ANALYTICS, updatedMessage.campaign_id, {
        campaignId: updatedMessage.campaign_id,
        userId: updatedMessage.user_id,
        messageId: messageId,
        status,
        timestamp: timestamp
          ? new Date(parseInt(timestamp, 10) * 1000).toISOString()
          : new Date().toISOString(),
        conversationType: conversationInfo?.origin?.type || undefined,
        pricingCategory: pricingInfo?.category || undefined,
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to publish campaign analytics to Kafka:',
        err.message
      );
    }
  }

  if (kafkaProducer && account?.id && account?.user_id) {
    try {
      await publishEvent(kafkaProducer, TOPICS.WHATSAPP_MESSAGE_STATUS, messageId, {
        userId: account.user_id,
        waAccountId: account.id,
        wabaId: String(wabaId),
        phoneNumberId: String(phoneNumberId),
        metaMessageId: messageId,
        contactPhone: recipientId || updatedMessage?.contact_phone || undefined,
        status,
        pricingModel: pricingInfo?.pricing_model || undefined,
        pricingCategory: pricingInfo?.category || undefined,
        errorCode: errorInfo ? String(errorInfo.code || '') : undefined,
        errorMessage: errorInfo?.message || undefined,
        campaignId: updatedMessage?.campaign_id || undefined,
        timestamp: timestamp
          ? new Date(parseInt(timestamp, 10) * 1000).toISOString()
          : new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to publish status update to Kafka:',
        err.message
      );
    }
  }
}

/**
 * Handles template status update events from Meta (approved, rejected, etc.).
 *
 * @param {string} wabaId - WABA ID
 * @param {object} value - The change value containing template status info
 * @param {object|null} kafkaProducer - Kafka producer
 */
async function handleTemplateStatusUpdate(wabaId, value, kafkaProducer) {
  const account = await WaAccount.findOne({
    where: { waba_id: String(wabaId) },
    order: [['updated_at', 'DESC']],
  });
  const templateEvent = {
    message_template_id: value.message_template_id,
    message_template_name: value.message_template_name,
    message_template_language: value.message_template_language,
    event: value.event, // APPROVED, REJECTED, PENDING_DELETION, etc.
    reason: value.reason || null,
  };

  console.log(
    `[whatsapp-service] Template status update for WABA ${wabaId}: ` +
      `template="${templateEvent.message_template_name}" status="${templateEvent.event}"`
  );

  // Publish to Kafka for template-service or notification-service
  if (kafkaProducer) {
    try {
      await publishEvent(kafkaProducer, TOPICS.WHATSAPP_TEMPLATE_STATUS, wabaId, {
        userId: account?.user_id || null,
        waAccountId: account?.id || null,
        wabaId: String(wabaId),
        phoneNumberId: account?.phone_number_id || null,
        messageTemplateId: templateEvent.message_template_id || null,
        messageTemplateName: templateEvent.message_template_name,
        messageTemplateLanguage: templateEvent.message_template_language || null,
        status: templateEvent.event,
        reason: templateEvent.reason,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to publish template status to Kafka:',
        err.message
      );
    }
  }
}

/**
 * Handles phone number quality update events from Meta.
 *
 * @param {string} wabaId - WABA ID
 * @param {object} value - The change value containing quality info
 */
async function publishAccountLifecycleEvent(kafkaProducer, account, lifecycleType, extra = {}) {
  if (!kafkaProducer || !account) {
    return;
  }

  try {
    await publishEvent(kafkaProducer, TOPICS.WHATSAPP_ACCOUNT_LIFECYCLE, account.id, {
      userId: account.user_id,
      waAccountId: account.id,
      wabaId: String(account.waba_id),
      phoneNumberId: String(account.phone_number_id),
      lifecycleType,
      accountStatus: account.status,
      onboardingStatus: account.onboarding_status,
      qualityRating: account.quality_rating || null,
      messagingLimit: account.messaging_limit || null,
      appSubscriptionStatus: account.app_subscription_status || null,
      creditSharingStatus: account.credit_sharing_status || null,
      error: extra.error || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[whatsapp-service] Failed to publish account lifecycle update:', err.message);
  }
}

async function handlePhoneQualityUpdate(wabaId, value, kafkaProducer) {
  const displayPhone = value.display_phone_number;
  const currentLimit = value.current_limit;
  const qualityRating = value.event; // GREEN, YELLOW, RED

  console.log(
    `[whatsapp-service] Phone quality update for WABA ${wabaId}: ` +
      `phone="${displayPhone}" quality="${qualityRating}" limit="${currentLimit}"`
  );

  // Find account by WABA and update quality rating
  // The event value contains the display_phone_number, but we need to find the account
  if (qualityRating) {
    const validRatings = ['GREEN', 'YELLOW', 'RED'];
    const rating = qualityRating.toUpperCase();
    if (validRatings.includes(rating)) {
      // Find accounts for this WABA and update their quality rating
      const accounts = await WaAccount.findAll({
        where: { waba_id: String(wabaId) },
      });

      for (const account of accounts) {
        // Match by display_phone if we have it, otherwise update all for this WABA
        if (!displayPhone || account.display_phone === displayPhone) {
          await account.update({
            quality_rating: rating,
            messaging_limit: currentLimit || account.messaging_limit,
            last_health_checked_at: new Date(),
          });
          await publishAccountLifecycleEvent(kafkaProducer, account, 'quality_update');
        }
      }
    }
  }
}

/**
 * Handles account-level status update events from Meta (ban, restrict, etc.).
 *
 * @param {string} wabaId - WABA ID
 * @param {object} value - The change value containing account status info
 */
async function handleAccountUpdate(wabaId, value, kafkaProducer) {
  const event = value.event;

  console.log(
    `[whatsapp-service] Account update for WABA ${wabaId}: event="${event}"`
  );

  // Map Meta account events to our account statuses
  let newStatus = null;
  if (event === 'DISABLED' || event === 'BANNED') {
    newStatus = 'banned';
  } else if (event === 'RESTRICTED') {
    newStatus = 'restricted';
  } else if (event === 'ENABLED' || event === 'UNBLOCKED') {
    newStatus = 'active';
  }

  if (newStatus) {
    const accounts = await WaAccount.findAll({
      where: { waba_id: String(wabaId) },
    });

    for (const account of accounts) {
      await account.update({
        status: newStatus,
        onboarding_status:
          newStatus === 'active'
            ? (account.onboarding_status === 'failed' ? 'failed' : 'active')
            : 'needs_reconcile',
        last_health_checked_at: new Date(),
      });
      await publishAccountLifecycleEvent(kafkaProducer, account, 'account_update', {
        error: event || null,
      });
    }
  }
}

module.exports = {
  verifyWebhook,
  processWebhook,
  extractMessageContent,
};
