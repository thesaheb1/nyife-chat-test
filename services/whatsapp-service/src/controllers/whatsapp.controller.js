'use strict';

const accountService = require('../services/account.service');
const messageService = require('../services/message.service');
const webhookService = require('../services/webhook.service');
const { successResponse, AppError } = require('@nyife/shared-utils');
const {
  embeddedSignupPreviewSchema,
  embeddedSignupCompleteSchema,
  sendMessageSchema,
  sendTemplateSchema,
  sendFlowSchema,
  listMessagesSchema,
  contactPhoneParamSchema,
  accountIdParamSchema,
  reconcileAccountSchema,
  resolveCampaignMediaSchema,
  accountProductCatalogsSchema,
  webhookVerifySchema,
  flowDataExchangeSchema,
} = require('../validations/whatsapp.validation');

// ────────────────────────────────────────────────
// Account Endpoints
// ────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/accounts/embedded-signup/preview
 * Exchanges the Meta authorization code, discovers available phone numbers,
 * and stores a short-lived signup session in Redis.
 */
async function previewEmbeddedSignup(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const data = embeddedSignupPreviewSchema.parse(req.body);
  const redis = req.app.locals.redis || null;

  const preview = await accountService.previewEmbeddedSignup(userId, data.code, redis);

  return successResponse(
    res,
    preview,
    'Embedded signup preview loaded successfully'
  );
}

/**
 * POST /api/v1/whatsapp/accounts/embedded-signup
 * Completes the Meta Embedded Signup flow using the preview session and a
 * phone number selection. Nyife registers each selected number server-side.
 */
async function handleEmbeddedSignup(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const data = embeddedSignupCompleteSchema.parse(req.body);
  const redis = req.app.locals.redis || null;
  const kafkaProducer = req.app.locals.kafkaProducer || null;

  const result = await accountService.completeEmbeddedSignup(
    userId,
    data.signup_session_id,
    data.waba_id || null,
    data.phone_number_ids,
    redis,
    kafkaProducer
  );

  return successResponse(
    res,
    result,
    'WhatsApp account connection completed successfully',
    201
  );
}

/**
 * GET /api/v1/whatsapp/accounts
 * Lists all WhatsApp accounts for the authenticated user.
 */
async function listAccounts(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const accounts = await accountService.listAccounts(userId);
  return successResponse(res, { accounts }, 'WhatsApp accounts retrieved');
}

/**
 * GET /api/v1/whatsapp/accounts/:id
 * Gets a single WhatsApp account by ID for the authenticated user.
 */
async function getAccount(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = accountIdParamSchema.parse(req.params);

  const account = await accountService.getAccount(userId, id);
  return successResponse(res, { account }, 'WhatsApp account retrieved');
}

/**
 * DELETE /api/v1/whatsapp/accounts/:id
 * Deactivates (soft-disables) a WhatsApp account.
 */
async function deactivateAccount(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = accountIdParamSchema.parse(req.params);
  const kafkaProducer = req.app.locals.kafkaProducer || null;

  const account = await accountService.deactivateAccount(userId, id, kafkaProducer);
  return successResponse(res, { account }, 'WhatsApp account deactivated');
}

async function getAccountHealth(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = accountIdParamSchema.parse(req.params);
  const kafkaProducer = req.app.locals.kafkaProducer || null;
  const redis = req.app.locals.redis || null;

  const result = await accountService.getAccountHealth(userId, id, kafkaProducer, redis);
  return successResponse(res, result, 'WhatsApp account health retrieved');
}

async function reconcileAccount(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = accountIdParamSchema.parse(req.params);
  reconcileAccountSchema.parse(req.body ?? {});
  const kafkaProducer = req.app.locals.kafkaProducer || null;
  const redis = req.app.locals.redis || null;

  const result = await accountService.reconcileAccount(userId, id, kafkaProducer, redis);
  return successResponse(res, result, 'WhatsApp account reconciled successfully');
}

/**
 * GET /api/v1/whatsapp/accounts/:id/phone-numbers
 * Fetches phone numbers for a WhatsApp account from Meta API.
 */
async function getPhoneNumbers(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { id } = accountIdParamSchema.parse(req.params);

  const phoneNumbers = await accountService.getPhoneNumbers(userId, id);
  return successResponse(res, { phone_numbers: phoneNumbers }, 'Phone numbers retrieved');
}

// ────────────────────────────────────────────────
// Message Endpoints
// ────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/send
 * Sends a direct (non-template) message via WhatsApp.
 */
async function sendMessage(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const data = sendMessageSchema.parse(req.body);

  const message = await messageService.sendMessage(userId, data);

  return successResponse(res, { message }, 'Message sent successfully', 201);
}

/**
 * POST /api/v1/whatsapp/send/template
 * Sends a pre-configured template message via WhatsApp.
 */
async function sendTemplateMessage(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const data = sendTemplateSchema.parse(req.body);

  const message = await messageService.sendTemplateMessage(userId, data);

  return successResponse(res, { message }, 'Template message sent successfully', 201);
}

/**
 * POST /api/v1/whatsapp/send/flow
 * Sends a standalone WhatsApp Flow message.
 */
async function sendFlowMessage(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const data = sendFlowSchema.parse(req.body);

  const message = await messageService.sendFlowMessage(userId, data);

  return successResponse(res, { message }, 'Flow message sent successfully', 201);
}

async function resolveCampaignMedia(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  if (!userId) {
    throw AppError.unauthorized('Campaign media resolution requires internal organization context.');
  }

  const data = resolveCampaignMediaSchema.parse(req.body);

  const media = await messageService.resolveCampaignMediaBindings(
    userId,
    data.wa_account_id,
    data.media_bindings
  );

  return successResponse(res, { media }, 'Campaign media resolved successfully');
}

async function getAccountProductCatalogs(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  if (!userId) {
    throw AppError.unauthorized('Product catalog lookup requires internal organization context.');
  }

  const data = accountProductCatalogsSchema.parse(req.body);
  const productCatalogs = await accountService.getAccountProductCatalogs(userId, data.wa_account_id);

  return successResponse(res, { product_catalogs: productCatalogs }, 'Account product catalogs retrieved successfully');
}

/**
 * GET /api/v1/whatsapp/messages
 * Lists messages with filters and pagination.
 */
async function listMessages(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const filters = listMessagesSchema.parse(req.query);

  const { messages, meta } = await messageService.listMessages(userId, filters);

  return successResponse(res, { messages }, 'Messages retrieved', 200, meta);
}

/**
 * GET /api/v1/whatsapp/messages/:contactPhone
 * Gets the conversation history with a specific contact.
 * Requires wa_account_id as a query parameter.
 */
async function getConversation(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const { contactPhone } = contactPhoneParamSchema.parse(req.params);
  const waAccountId = req.query.wa_account_id;

  if (!waAccountId) {
    const { AppError } = require('@nyife/shared-utils');
    throw AppError.badRequest('wa_account_id query parameter is required');
  }

  const messages = await messageService.getConversation(userId, waAccountId, contactPhone);

  return successResponse(res, { messages }, 'Conversation retrieved');
}

// ────────────────────────────────────────────────
// Webhook Endpoints
// ────────────────────────────────────────────────

/**
 * GET /api/v1/whatsapp/webhook
 * Meta webhook verification (challenge-response).
 * Public — no auth required.
 */
async function verifyWebhook(req, res) {
  if (
    req.query['hub.mode'] === undefined &&
    req.query['hub.verify_token'] === undefined &&
    req.query['hub.challenge'] === undefined
  ) {
    return res.status(200).json({
      success: true,
      message: 'WhatsApp webhook endpoint is ready',
    });
  }

  const query = webhookVerifySchema.parse(req.query);
  const challenge = webhookService.verifyWebhook(query);

  // Return challenge as plain text with 200
  return res.status(200).type('text/plain').send(challenge);
}

/**
 * POST /api/v1/whatsapp/webhook
 * Meta webhook event handler.
 * Public — no auth required, signature verified by middleware.
 *
 * IMPORTANT: Respond 200 immediately, then process asynchronously.
 */
async function processWebhook(req, res) {
  // Respond 200 immediately to Meta (they require a fast response)
  res.status(200).json({ status: 'received' });
  console.log(
    `[whatsapp-service] Webhook received (format=${req.webhookEnvelopeFormat || 'unknown'}, auth=${req.webhookAuth?.strategy || 'unknown'})`
  );

  // Process webhook asynchronously (after response is sent)
  const kafkaProducer = req.app.locals.kafkaProducer || null;
  const redis = req.app.locals.redis || null;

  try {
    await webhookService.processWebhook(req.body, kafkaProducer, { redis });
  } catch (err) {
    console.error('[whatsapp-service] Webhook processing error:', err.message);
  }
}


/**
 * POST /api/v1/whatsapp/flows/data-exchange
 * Public Meta callback for WhatsApp Flow data exchange.
 */
async function handleFlowDataExchange(req, res) {
  const payload = flowDataExchangeSchema.parse(req.body || {});
  const result = await messageService.handleFlowDataExchange(payload, req.headers['x-tenant-user-id'] || null);
  return res.status(200).json(result);
}

// ────────────────────────────────────────────────
// Developer API Endpoint
// ────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/developer/send
 * Sends a message using the developer API token auth.
 * Uses the same sendMessage logic — the auth middleware provides x-user-id.
 */
async function developerSend(req, res) {
  const userId = req.organizationId || req.headers['x-organization-id'] || req.headers['x-user-id'] || req.user?.id;
  const data = sendMessageSchema.parse(req.body);

  const message = await messageService.sendMessage(userId, data);

  return successResponse(res, { message }, 'Message sent successfully', 201);
}

module.exports = {
  previewEmbeddedSignup,
  handleEmbeddedSignup,
  listAccounts,
  getAccount,
  deactivateAccount,
  getAccountHealth,
  reconcileAccount,
  getPhoneNumbers,
  sendMessage,
  sendTemplateMessage,
  sendFlowMessage,
  resolveCampaignMedia,
  getAccountProductCatalogs,
  listMessages,
  getConversation,
  verifyWebhook,
  processWebhook,
  handleFlowDataExchange,
  developerSend,
};
