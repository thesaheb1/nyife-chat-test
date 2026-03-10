'use strict';

const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { WaAccount, WaMessage } = require('../models');
const { AppError, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');
const { requireResolvedMetaCredential } = require('./metaAccess.service');

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

async function fetchFlowRecord(userId, flowId) {
  if (!isUuid(flowId)) {
    return {
      id: null,
      name: null,
      meta_flow_id: flowId,
      json_definition: null,
    };
  }

  try {
    const response = await axios.get(
      `${config.templateServiceUrl}/api/v1/flows/${flowId}`,
      {
        headers: { 'x-user-id': userId },
        timeout: 10000,
      }
    );

    return response.data?.data?.flow || response.data?.data || null;
  } catch (err) {
    throw AppError.badRequest(
      `Failed to resolve flow: ${err.response?.data?.message || err.message}`
    );
  }
}

async function extractTemplateLinkedFlows(userId, template) {
  const buttonsComponent = Array.isArray(template?.components)
    ? template.components.find((component) => component.type === 'BUTTONS')
    : null;

  if (!buttonsComponent || !Array.isArray(buttonsComponent.buttons)) {
    return [];
  }

  const linkedFlows = [];
  for (let index = 0; index < buttonsComponent.buttons.length; index += 1) {
    const button = buttonsComponent.buttons[index];
    if (button.type !== 'FLOW' || !button.flow_id) {
      continue;
    }

    try {
      const flow = await fetchFlowRecord(userId, button.flow_id);
      linkedFlows.push({
        button_index: index,
        local_flow_id: flow?.id || (isUuid(button.flow_id) ? button.flow_id : null),
        meta_flow_id: flow?.meta_flow_id || (!isUuid(button.flow_id) ? button.flow_id : null),
        flow_name: flow?.name || button.flow_name || null,
      });
    } catch (err) {
      console.warn('[whatsapp-service] Failed to resolve linked template flow:', err.message);
    }
  }

  return linkedFlows;
}

/**
 * Builds the Meta API message payload for all supported message types.
 *
 * @param {string} type - Message type (text, image, video, audio, document, sticker, location, contacts, reaction, interactive, template)
 * @param {string} to - Recipient phone number
 * @param {object} messageData - Type-specific payload data
 * @param {object|undefined} context - Optional reply context with message_id
 * @returns {object} Meta API-compatible message payload
 */
function buildMessagePayload(type, to, messageData, context) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type,
  };

  if (context && context.message_id) {
    payload.context = { message_id: context.message_id };
  }

  switch (type) {
    case 'text':
      payload.text = {
        preview_url: messageData.preview_url || false,
        body: messageData.body,
      };
      break;

    case 'image':
      payload.image = {};
      if (messageData.id) {
        payload.image.id = messageData.id;
      } else if (messageData.link) {
        payload.image.link = messageData.link;
      }
      if (messageData.caption) {
        payload.image.caption = messageData.caption;
      }
      break;

    case 'video':
      payload.video = {};
      if (messageData.id) {
        payload.video.id = messageData.id;
      } else if (messageData.link) {
        payload.video.link = messageData.link;
      }
      if (messageData.caption) {
        payload.video.caption = messageData.caption;
      }
      break;

    case 'audio':
      payload.audio = {};
      if (messageData.id) {
        payload.audio.id = messageData.id;
      } else if (messageData.link) {
        payload.audio.link = messageData.link;
      }
      break;

    case 'document':
      payload.document = {};
      if (messageData.id) {
        payload.document.id = messageData.id;
      } else if (messageData.link) {
        payload.document.link = messageData.link;
      }
      if (messageData.caption) {
        payload.document.caption = messageData.caption;
      }
      if (messageData.filename) {
        payload.document.filename = messageData.filename;
      }
      break;

    case 'sticker':
      payload.sticker = {};
      if (messageData.id) {
        payload.sticker.id = messageData.id;
      } else if (messageData.link) {
        payload.sticker.link = messageData.link;
      }
      break;

    case 'location':
      payload.location = {
        latitude: String(messageData.latitude),
        longitude: String(messageData.longitude),
      };
      if (messageData.name) {
        payload.location.name = messageData.name;
      }
      if (messageData.address) {
        payload.location.address = messageData.address;
      }
      break;

    case 'contacts':
      payload.contacts = Array.isArray(messageData) ? messageData : messageData.contacts || [messageData];
      break;

    case 'reaction':
      payload.reaction = {
        message_id: messageData.message_id,
        emoji: messageData.emoji,
      };
      break;

    case 'interactive':
      payload.interactive = messageData;
      break;

    case 'template':
      payload.template = messageData;
      break;

    default:
      // For unknown types, attach data directly under the type key
      payload[type] = messageData;
      break;
  }

  return payload;
}

function normalizeBillingCategory(category, fallbackCategory = null) {
  if (!category && fallbackCategory) {
    return normalizeBillingCategory(fallbackCategory);
  }

  const normalized = String(category || '').trim().toLowerCase();
  switch (normalized) {
    case 'marketing':
      return 'marketing';
    case 'utility':
      return 'utility';
    case 'authentication':
    case 'auth':
      return 'authentication';
    case 'service':
    case 'user_initiated':
      return 'service';
    case 'referral_conversion':
    case 'referral':
      return 'referral_conversion';
    case 'business_initiated':
      return fallbackCategory ? normalizeBillingCategory(fallbackCategory) : null;
    default:
      return fallbackCategory ? normalizeBillingCategory(fallbackCategory) : null;
  }
}

function getPlanPriceForCategory(plan, category) {
  const normalizedCategory = normalizeBillingCategory(category);
  if (!plan || !normalizedCategory) {
    return 0;
  }

  switch (normalizedCategory) {
    case 'marketing':
      return Number(plan.marketing_message_price || 0);
    case 'utility':
      return Number(plan.utility_message_price || 0);
    case 'authentication':
      return Number(plan.auth_message_price || 0);
    case 'service':
      return Number(plan.service_message_price || 0);
    case 'referral_conversion':
      return Number(plan.referral_conversion_message_price || 0);
    default:
      return 0;
  }
}

function serializeMessageRecord(messageRecord) {
  return {
    id: messageRecord.id,
    user_id: messageRecord.user_id,
    wa_account_id: messageRecord.wa_account_id,
    contact_phone: messageRecord.contact_phone,
    direction: messageRecord.direction,
    type: messageRecord.type,
    content: messageRecord.content,
    meta_message_id: messageRecord.meta_message_id,
    status: messageRecord.status,
    template_id: messageRecord.template_id,
    campaign_id: messageRecord.campaign_id,
    billing_status: messageRecord.billing_status,
    billing_category_estimated: messageRecord.billing_category_estimated,
    billing_category_actual: messageRecord.billing_category_actual,
    billing_amount_estimated: messageRecord.billing_amount_estimated,
    billing_amount_actual: messageRecord.billing_amount_actual,
    created_at: messageRecord.created_at,
  };
}

async function fetchActiveSubscription(userId) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/internal/active/${userId}`,
      {
        timeout: 10000,
      }
    );

    return response.data?.data?.subscription || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    throw AppError.badRequest(`Unable to load active subscription: ${message}`);
  }
}

function getMessageLimitState(subscription) {
  const limit = Number(subscription?.plan?.max_messages_per_month || 0);
  const used = Number(subscription?.usage?.messages_this_month || 0);
  if (!subscription) {
    return { limit: 0, used: 0, remaining: 0, allowed: false };
  }
  if (limit === 0) {
    return { limit: Infinity, used, remaining: Infinity, allowed: true };
  }

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}

async function getWalletBalance(userId) {
  try {
    const response = await axios.get(
      `${config.walletServiceUrl}/api/v1/wallet/balance/${userId}`,
      { timeout: 10000 }
    );
    return response.data?.data || { balance: 0 };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    throw AppError.badRequest(`Unable to verify wallet balance: ${message}`);
  }
}

async function debitWalletForMessage(userId, amount, messageRecord, description, category) {
  if (!amount) {
    return null;
  }

  const response = await axios.post(
    `${config.walletServiceUrl}/api/v1/wallet/debit`,
    {
      user_id: userId,
      amount,
      source: 'message_debit',
      reference_type: 'wa_message',
      reference_id: messageRecord.id,
      description,
      meta: {
        wa_message_id: messageRecord.id,
        wa_account_id: messageRecord.wa_account_id,
        billing_category: category,
      },
    },
    {
      headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );

  return response.data?.data || null;
}

async function creditWalletForMessage(userId, amount, messageRecord, source, description, meta = {}) {
  if (!amount) {
    return null;
  }

  const response = await axios.post(
    `${config.walletServiceUrl}/api/v1/wallet/credit`,
    {
      user_id: userId,
      amount,
      source,
      reference_type: 'wa_message',
      reference_id: messageRecord.id,
      description,
      meta: {
        wa_message_id: messageRecord.id,
        wa_account_id: messageRecord.wa_account_id,
        ...meta,
      },
    },
    {
      headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );

  return response.data?.data || null;
}

async function incrementMessageUsage(userId, messageRecord) {
  if (messageRecord.usage_applied_at) {
    return messageRecord;
  }

  await axios.post(
    `${config.subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${userId}`,
    {
      resource: 'messages',
      count: 1,
    },
    {
      timeout: 10000,
    }
  );

  await messageRecord.update({
    usage_applied_at: new Date(),
  });

  return messageRecord;
}

async function sendMetaPayload(account, payload, credential) {
  return axios.post(
    `${config.meta.baseUrl}/${account.phone_number_id}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${credential.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

async function performAccountedSend({
  userId,
  account,
  type,
  content,
  payload,
  to,
  estimatedCategory,
  description,
  templateId = null,
  campaignId = null,
}) {
  const credential = requireResolvedMetaCredential(account);
  const subscription = await fetchActiveSubscription(userId);
  if (!subscription || !subscription.plan) {
    throw AppError.forbidden('An active subscription is required to send WhatsApp messages.');
  }

  const messageLimit = getMessageLimitState(subscription);
  if (!messageLimit.allowed) {
    throw AppError.forbidden('Monthly message limit reached. Please upgrade your plan.');
  }

  const normalizedEstimatedCategory = normalizeBillingCategory(estimatedCategory);
  const estimatedAmount = getPlanPriceForCategory(subscription.plan, normalizedEstimatedCategory);
  const walletBalance = await getWalletBalance(userId);
  if (estimatedAmount > Number(walletBalance.balance || 0)) {
    throw AppError.badRequest(
      `Insufficient wallet balance. Required: ${estimatedAmount} paise, Available: ${walletBalance.balance || 0} paise.`
    );
  }

  const messageRecord = await WaMessage.create({
    user_id: userId,
    wa_account_id: account.id,
    contact_phone: to,
    direction: 'outbound',
    type,
    content,
    status: 'pending',
    template_id: templateId,
    campaign_id: campaignId,
    billing_category_estimated: normalizedEstimatedCategory,
    billing_amount_estimated: estimatedAmount,
    billing_status: estimatedAmount > 0 ? 'pending_debit' : 'pending_reconcile',
  });

  let debitResult = null;
  try {
    debitResult = await debitWalletForMessage(
      userId,
      estimatedAmount,
      messageRecord,
      description,
      normalizedEstimatedCategory
    );
  } catch (err) {
    await messageRecord.update({
      status: 'failed',
      error_message: err.response?.data?.message || err.message,
      billing_status: 'debit_failed',
    });
    throw AppError.badRequest(err.response?.data?.message || err.message);
  }

  if (debitResult?.transaction_id) {
    await messageRecord.update({
      wallet_debit_transaction_id: debitResult.transaction_id,
      billing_status: estimatedAmount > 0 ? 'debited' : 'pending_reconcile',
    });
  }

  try {
    const metaResponse = await sendMetaPayload(account, payload, credential);
    const metaMessageId = metaResponse.data?.messages?.[0]?.id || null;

    await messageRecord.update({
      meta_message_id: metaMessageId,
      status: 'sent',
      billing_status: estimatedAmount > 0 ? 'debited_pending_reconcile' : 'pending_reconcile',
    });

    await incrementMessageUsage(userId, messageRecord);
    await messageRecord.reload();

    return messageRecord;
  } catch (err) {
    const errData = err.response?.data?.error || {};
    const errorCode = String(errData.code || err.response?.status || 'UNKNOWN');
    const errorMessage = errData.message || err.message || 'Unknown Meta API error';

    let refundTransactionId = null;
    if (estimatedAmount > 0 && messageRecord.wallet_debit_transaction_id) {
      try {
        const refundResult = await creditWalletForMessage(
          userId,
          estimatedAmount,
          messageRecord,
          'message_refund',
          `Refund for failed WhatsApp ${type} message to ${to}`,
          { reason: 'meta_send_failed' }
        );
        refundTransactionId = refundResult?.transaction_id || null;
      } catch (refundErr) {
        console.error(
          '[whatsapp-service] Failed to refund wallet after message send failure:',
          refundErr.response?.data?.message || refundErr.message
        );
      }
    }

    await messageRecord.update({
      status: 'failed',
      error_code: errorCode,
      error_message: errorMessage,
      billing_status: refundTransactionId ? 'refunded_failed_send' : 'refund_pending',
      wallet_adjustment_transaction_id: refundTransactionId,
      billing_amount_actual: 0,
      billing_reconciled_at: refundTransactionId ? new Date() : null,
    });

    throw AppError.badRequest(`Failed to send ${type === 'template' ? 'template message' : 'message'}: ${errorMessage}`);
  }
}

/**
 * Sends a message via Meta WhatsApp Cloud API.
 *
 * 1. Get WA account, decrypt access token
 * 2. Build Meta API payload based on message type
 * 3. POST to /{phone_number_id}/messages
 * 4. Log message in wa_messages
 * 5. Debit wallet via HTTP call
 * 6. Return message record with meta_message_id
 *
 * @param {string} userId - The tenant user ID
 * @param {object} data - Validated send message data
 * @param {string} data.wa_account_id - WA account UUID
 * @param {string} data.to - Recipient phone number
 * @param {string} data.type - Message type
 * @param {object} data.message - Type-specific payload
 * @param {object} [data.context] - Optional reply context
 * @returns {Promise<object>} Created WaMessage record
 */
async function sendMessage(userId, data) {
  const { wa_account_id, to, type, message, context } = data;

  // Get WA account with access token
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: wa_account_id, user_id: userId },
  });
  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }
  if (account.status !== 'active') {
    throw AppError.forbidden('WhatsApp account is not active');
  }

  const payload = buildMessagePayload(type, to, message, context);

  const messageRecord = await performAccountedSend({
    userId,
    account,
    type,
    content: message,
    payload,
    to,
    estimatedCategory: 'service',
    description: `WhatsApp ${type} message to ${to}`,
  });

  return serializeMessageRecord(messageRecord);
}

/**
 * Sends a pre-configured template message.
 *
 * 1. Get WA account + template from template-service
 * 2. Build template payload with variables
 * 3. Send via Meta API
 * 4. Log in wa_messages
 * 5. Debit wallet
 * 6. Return message record
 *
 * @param {string} userId - The tenant user ID
 * @param {object} data - Validated send template data
 * @param {string} data.wa_account_id - WA account UUID
 * @param {string} data.to - Recipient phone number
 * @param {string} data.template_id - Template UUID
 * @param {object} [data.variables] - Variable values for the template
 * @returns {Promise<object>} Created WaMessage record
 */
async function sendTemplateMessage(userId, data) {
  const { wa_account_id, to, template_id, variables } = data;

  // Get WA account with access token
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: wa_account_id, user_id: userId },
  });
  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }
  if (account.status !== 'active') {
    throw AppError.forbidden('WhatsApp account is not active');
  }

  // Fetch template from template-service
  let template;
  try {
    const templateResponse = await axios.get(
      `${config.templateServiceUrl}/api/v1/templates/${template_id}`,
      {
        headers: { 'x-user-id': userId },
      }
    );
    template = templateResponse.data?.data?.template || templateResponse.data?.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw AppError.notFound('Template not found');
    }
    throw AppError.badRequest(
      `Failed to fetch template: ${err.response?.data?.message || err.message}`
    );
  }

  if (!template || !template.name) {
    throw AppError.notFound('Template not found or missing name');
  }

  if (template.status && template.status !== 'APPROVED' && template.status !== 'approved') {
    throw AppError.badRequest(`Template is not approved. Current status: ${template.status}`);
  }

  if (template.waba_id && String(template.waba_id) !== String(account.waba_id)) {
    throw AppError.badRequest(
      `Template belongs to WABA ${template.waba_id}, but the selected WhatsApp account belongs to WABA ${account.waba_id}.`
    );
  }

  const linkedFlows = await extractTemplateLinkedFlows(userId, template);

  // Build template components with variables
  const components = buildTemplateComponents(template, variables || {});

  // Build Meta API payload
  const templatePayload = {
    name: template.name,
    language: {
      code: template.language || 'en_US',
    },
  };

  if (components.length > 0) {
    templatePayload.components = components;
  }

  const fullPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: templatePayload,
  };

  const messageRecord = await performAccountedSend({
    userId,
    account,
    type: 'template',
    content: {
      ...templatePayload,
      linked_flows: linkedFlows,
    },
    payload: fullPayload,
    to,
    estimatedCategory: template.category,
    description: `WhatsApp template "${template.name}" to ${to}`,
    templateId: template_id,
  });

  return serializeMessageRecord(messageRecord);
}

/**
 * Sends a standalone WhatsApp Flow message.
 */
async function sendFlowMessage(userId, data) {
  const {
    wa_account_id,
    to,
    flow_id,
    flow_cta,
    flow_token,
    flow_message_version,
    flow_action,
    flow_action_payload,
    body_text,
    header_text,
    footer_text,
  } = data;

  const flow = await fetchFlowRecord(userId, flow_id);
  const metaFlowId = flow?.meta_flow_id || (!isUuid(flow_id) ? flow_id : null);
  if (!metaFlowId) {
    throw AppError.badRequest('Save and publish this flow before sending it on WhatsApp.');
  }

  const firstScreenId = flow?.json_definition?.screens?.[0]?.id || null;
  const resolvedToken = flow_token || `nyife_flow_${crypto.randomUUID()}`;

  const interactive = {
    type: 'flow',
    ...(header_text ? { header: { type: 'text', text: header_text } } : {}),
    body: {
      text: body_text || `Continue with ${flow?.name || 'this flow'}.`,
    },
    ...(footer_text ? { footer: { text: footer_text } } : {}),
    action: {
      name: 'flow',
      parameters: {
        flow_message_version: flow_message_version || '3',
        flow_id: metaFlowId,
        flow_token: resolvedToken,
        flow_cta,
        flow_action: flow_action || 'navigate',
        ...(flow_action_payload
          ? { flow_action_payload }
          : (firstScreenId && (flow_action || 'navigate') === 'navigate')
            ? { flow_action_payload: { screen: firstScreenId } }
            : {}),
      },
    },
  };

  const sent = await sendMessage(userId, {
    wa_account_id,
    to,
    type: 'interactive',
    message: interactive,
  });

  const enrichedContent = {
    ...interactive,
    local_flow_id: flow?.id || null,
    meta_flow_id: metaFlowId,
    flow_token: resolvedToken,
  };

  await WaMessage.update(
    {
      content: enrichedContent,
    },
    {
      where: { id: sent.id },
    }
  );

  return {
    ...sent,
    content: enrichedContent,
  };
}

/**
 * Builds template components array with resolved variables.
 *
 * Maps variable values into template component parameters using Meta's
 * expected format: { type: "text", text: "value" } for body/header text params,
 * and media objects for header media.
 *
 * @param {object} template - Template record from template-service
 * @param {object} variables - Variable values keyed by component type and index
 *   Example: { header: ["image_url"], body: ["John", "Doe", "Order123"] }
 * @returns {Array} Array of Meta API template component objects
 */
function buildTemplateComponents(template, variables) {
  const components = [];

  // Build header component if variables provided
  if (variables.header && Array.isArray(variables.header) && variables.header.length > 0) {
    const headerComponent = { type: 'header', parameters: [] };
    const templateComponents = template.components || [];
    const headerDef = templateComponents.find((c) => c.type === 'HEADER');

    if (headerDef) {
      const headerFormat = (headerDef.format || 'TEXT').toUpperCase();

      if (headerFormat === 'TEXT') {
        // Text header with variables
        for (const val of variables.header) {
          headerComponent.parameters.push({ type: 'text', text: String(val) });
        }
      } else if (headerFormat === 'IMAGE') {
        headerComponent.parameters.push({
          type: 'image',
          image: variables.header[0].id
            ? { id: variables.header[0].id }
            : { link: String(variables.header[0].link || variables.header[0]) },
        });
      } else if (headerFormat === 'VIDEO') {
        headerComponent.parameters.push({
          type: 'video',
          video: variables.header[0].id
            ? { id: variables.header[0].id }
            : { link: String(variables.header[0].link || variables.header[0]) },
        });
      } else if (headerFormat === 'DOCUMENT') {
        const docParam = {
          type: 'document',
          document: variables.header[0].id
            ? { id: variables.header[0].id }
            : { link: String(variables.header[0].link || variables.header[0]) },
        };
        if (variables.header[0].filename) {
          docParam.document.filename = variables.header[0].filename;
        }
        headerComponent.parameters.push(docParam);
      } else if (headerFormat === 'LOCATION') {
        headerComponent.parameters.push({
          type: 'location',
          location: {
            latitude: String(variables.header[0].latitude),
            longitude: String(variables.header[0].longitude),
            name: variables.header[0].name || '',
            address: variables.header[0].address || '',
          },
        });
      }
    } else {
      // No header definition found — treat as text params
      for (const val of variables.header) {
        headerComponent.parameters.push({ type: 'text', text: String(val) });
      }
    }

    if (headerComponent.parameters.length > 0) {
      components.push(headerComponent);
    }
  }

  // Build body component if variables provided
  if (variables.body && Array.isArray(variables.body) && variables.body.length > 0) {
    const bodyComponent = {
      type: 'body',
      parameters: variables.body.map((val) => {
        // Support currency and date_time types
        if (typeof val === 'object' && val !== null && val.type === 'currency') {
          return {
            type: 'currency',
            currency: {
              fallback_value: val.fallback_value,
              code: val.code,
              amount_1000: val.amount_1000,
            },
          };
        }
        if (typeof val === 'object' && val !== null && val.type === 'date_time') {
          return {
            type: 'date_time',
            date_time: {
              fallback_value: val.fallback_value,
            },
          };
        }
        return { type: 'text', text: String(val) };
      }),
    };
    components.push(bodyComponent);
  }

  // Build button component parameters if provided
  if (variables.buttons && Array.isArray(variables.buttons)) {
    for (let i = 0; i < variables.buttons.length; i++) {
      const btn = variables.buttons[i];
      if (btn) {
        const buttonComponent = {
          type: 'button',
          sub_type: btn.sub_type || btn.type || 'quick_reply',
          index: String(i),
          parameters: [],
        };

        if (btn.sub_type === 'url' || btn.type === 'url') {
          buttonComponent.parameters.push({ type: 'text', text: String(btn.value || btn.text) });
        } else if (btn.sub_type === 'quick_reply' || btn.type === 'quick_reply') {
          buttonComponent.parameters.push({ type: 'payload', payload: String(btn.value || btn.payload) });
        } else if (btn.sub_type === 'copy_code' || btn.type === 'copy_code') {
          buttonComponent.parameters.push({ type: 'coupon_code', coupon_code: String(btn.value || btn.coupon_code) });
        } else if (btn.sub_type === 'flow' || btn.type === 'flow') {
          // Flow buttons may have action payload
          if (btn.value) {
            buttonComponent.parameters.push({ type: 'action', action: btn.value });
          }
        }

        if (buttonComponent.parameters.length > 0) {
          components.push(buttonComponent);
        }
      }
    }
  }

  return components;
}

/**
 * Lists messages for a user with filters and pagination.
 *
 * @param {string} userId - The tenant user ID
 * @param {object} filters - Filter parameters
 * @returns {Promise<{messages: Array, meta: object}>}
 */
async function listMessages(userId, filters) {
  const { page, limit, direction, type, status, contact_phone, wa_account_id, date_from, date_to } = filters;

  const { offset, limit: queryLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (direction) {
    where.direction = direction;
  }
  if (type) {
    where.type = type;
  }
  if (status) {
    where.status = status;
  }
  if (contact_phone) {
    where.contact_phone = contact_phone;
  }
  if (wa_account_id) {
    where.wa_account_id = wa_account_id;
  }
  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      where.created_at[Op.lte] = new Date(date_to);
    }
  }

  const { count, rows } = await WaMessage.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: queryLimit,
    offset,
    include: [
      {
        model: WaAccount,
        as: 'waAccount',
        attributes: ['id', 'display_phone', 'verified_name', 'phone_number_id'],
      },
    ],
  });

  const meta = getPaginationMeta(count, page, limit);

  return {
    messages: rows,
    meta,
  };
}

/**
 * Gets the conversation history between a WA account and a contact phone.
 *
 * @param {string} userId - The tenant user ID
 * @param {string} waAccountId - The WA account UUID
 * @param {string} contactPhone - The contact phone number
 * @returns {Promise<Array>} Ordered list of messages
 */
async function getConversation(userId, waAccountId, contactPhone) {
  const messages = await WaMessage.findAll({
    where: {
      user_id: userId,
      wa_account_id: waAccountId,
      contact_phone: contactPhone,
    },
    order: [['created_at', 'ASC']],
    limit: 200, // Reasonable limit for conversation view
  });

  return messages;
}

async function reconcileMessageBilling(message, pricingInfo) {
  if (!message || message.direction !== 'outbound' || !pricingInfo) {
    return message;
  }

  const actualCategory = normalizeBillingCategory(
    pricingInfo.category,
    message.billing_category_estimated || message.pricing_category
  );
  const billable = typeof pricingInfo.billable === 'boolean'
    ? pricingInfo.billable
    : message.pricing_billable !== null
      ? Boolean(message.pricing_billable)
      : true;

  const currentActualAmount = message.billing_amount_actual === null
    ? null
    : Number(message.billing_amount_actual);
  const currentActualCategory = normalizeBillingCategory(
    message.billing_category_actual,
    message.billing_category_estimated
  );

  if (
    message.billing_reconciled_at
    && currentActualAmount !== null
    && currentActualAmount === (billable ? currentActualAmount : 0)
    && currentActualCategory === actualCategory
    && message.pricing_billable === billable
  ) {
    return message;
  }

  const subscription = await fetchActiveSubscription(message.user_id);
  if (!subscription?.plan) {
    throw AppError.badRequest('Unable to reconcile message billing without an active subscription.');
  }

  const actualAmount = billable
    ? getPlanPriceForCategory(subscription.plan, actualCategory)
    : 0;
  const estimatedAmount = Number(message.billing_amount_estimated || 0);
  const delta = estimatedAmount - actualAmount;

  let adjustmentTransactionId = message.wallet_adjustment_transaction_id || null;
  let billingStatus = 'reconciled';

  if (delta > 0) {
    const adjustment = await creditWalletForMessage(
      message.user_id,
      delta,
      message,
      'message_refund',
      `Billing reconciliation refund for WhatsApp message ${message.id}`,
      {
        estimated_amount: estimatedAmount,
        actual_amount: actualAmount,
        pricing_category: actualCategory,
      }
    );
    adjustmentTransactionId = adjustment?.transaction_id || adjustmentTransactionId;
  } else if (delta < 0) {
    try {
      const adjustment = await debitWalletForMessage(
        message.user_id,
        Math.abs(delta),
        message,
        `Billing reconciliation adjustment for WhatsApp message ${message.id}`,
        actualCategory
      );
      adjustmentTransactionId = adjustment?.transaction_id || adjustmentTransactionId;
      billingStatus = 'adjusted';
    } catch (err) {
      console.error(
        '[whatsapp-service] Failed to apply billing adjustment:',
        err.response?.data?.message || err.message
      );
      billingStatus = 'adjustment_failed';
    }
  }

  await message.update({
    billing_category_actual: actualCategory,
    billing_amount_actual: actualAmount,
    billing_status: billingStatus,
    pricing_billable: billable,
    wallet_adjustment_transaction_id: adjustmentTransactionId,
    billing_reconciled_at: billingStatus === 'adjustment_failed' ? null : new Date(),
  });

  return message;
}

/**
 * Updates a message status by Meta message ID (used by webhook processing).
 *
 * @param {string} metaMessageId - The WhatsApp wamid
 * @param {string} status - New status (sent, delivered, read, failed)
 * @param {object} [errorInfo] - Error details if status is 'failed'
 * @param {string} [errorInfo.code] - Error code
 * @param {string} [errorInfo.message] - Error message
 * @param {object} [pricingInfo] - Pricing information from Meta
 * @param {string} [pricingInfo.pricing_model] - Pricing model
 * @param {string} [pricingInfo.category] - Pricing category
 * @returns {Promise<object|null>} Updated message record or null if not found
 */
async function updateMessageStatus(metaMessageId, status, errorInfo, pricingInfo) {
  if (!metaMessageId) return null;

  const message = await WaMessage.findOne({
    where: { meta_message_id: metaMessageId },
  });

  if (!message) {
    return null;
  }

  // Only update if the new status is "forward" in the lifecycle
  // pending -> sent -> delivered -> read, failed can happen at any point
  const statusOrder = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
  const currentOrder = statusOrder[message.status] || 0;
  const newOrder = statusOrder[status] || 0;

  const shouldUpdateLifecycle = newOrder > currentOrder || status === 'failed';
  const updateData = shouldUpdateLifecycle ? { status } : {};

  if (status === 'failed' && errorInfo) {
    updateData.error_code = String(errorInfo.code || '');
    updateData.error_message = errorInfo.message || '';
  }

  if (pricingInfo) {
    if (pricingInfo.pricing_model) {
      updateData.pricing_model = pricingInfo.pricing_model;
    }
    if (pricingInfo.category) {
      updateData.pricing_category = pricingInfo.category;
    }
    if (typeof pricingInfo.billable === 'boolean') {
      updateData.pricing_billable = pricingInfo.billable;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await message.update(updateData);
  }

  if (pricingInfo) {
    await reconcileMessageBilling(message, pricingInfo);
  }

  await message.reload();

  return message;
}

/**
 * Sends a message directly for campaign execution (called by Kafka consumer).
 * Does not require userId validation since it is an internal call.
 *
 * @param {object} params - Campaign message params
 * @param {string} params.userId - User ID
 * @param {string} params.waAccountId - WA Account ID
 * @param {string} params.phoneNumber - Recipient phone number
 * @param {string} params.campaignId - Campaign ID
 * @param {string} params.templateName - Template name
 * @param {string} params.templateLanguage - Template language code
 * @param {Array} [params.components] - Template components
 * @param {string} [params.messageType] - Message type (default: template)
 * @param {string} [params.textContent] - Text content for text messages
 * @returns {Promise<object>} Message record
 */
async function sendCampaignMessage(params) {
  const {
    userId,
    waAccountId,
    phoneNumber,
    campaignId,
    templateName,
    templateLanguage,
    templateCategory,
    components,
    messageType,
    textContent,
  } = params;

  // Get WA account with access token
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: waAccountId },
  });

  if (!account || account.status !== 'active') {
    throw AppError.badRequest('WhatsApp account not available for campaign');
  }

  let payload;
  let msgType;
  let msgContent;
  let estimatedCategory;

  if (messageType === 'text' && textContent) {
    msgType = 'text';
    msgContent = { body: textContent };
    estimatedCategory = 'service';
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: { preview_url: false, body: textContent },
    };
  } else {
    msgType = 'template';
    estimatedCategory = templateCategory || 'marketing';
    const templatePayload = {
      name: templateName,
      language: { code: templateLanguage || 'en_US' },
    };
    if (components && components.length > 0) {
      templatePayload.components = components;
    }
    msgContent = templatePayload;
    payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'template',
      template: templatePayload,
    };
  }

  const messageRecord = await performAccountedSend({
    userId,
    account,
    type: msgType,
    content: msgContent,
    payload,
    to: phoneNumber,
    estimatedCategory,
    description: campaignId
      ? `Campaign ${campaignId} ${msgType} message to ${phoneNumber}`
      : `Campaign ${msgType} message to ${phoneNumber}`,
    campaignId,
  });

  return {
    id: messageRecord.id,
    meta_message_id: messageRecord.meta_message_id,
    status: messageRecord.status,
    campaign_id: campaignId,
  };
}

async function handleFlowDataExchange(payload, tenantUserId) {
  try {
    const response = await axios.post(
      `${config.templateServiceUrl}/api/v1/flows/data-exchange`,
      payload,
      {
        headers: {
          ...(tenantUserId ? { 'x-tenant-user-id': tenantUserId } : {}),
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return response.data?.data || response.data;
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Flow data exchange failed';
    throw AppError.badRequest(message);
  }
}

module.exports = {
  buildMessagePayload,
  sendMessage,
  sendTemplateMessage,
  sendFlowMessage,
  listMessages,
  getConversation,
  updateMessageStatus,
  sendCampaignMessage,
  handleFlowDataExchange,
};
