'use strict';

const accountService = require('../services/account.service');
const messageService = require('../services/message.service');
const webhookService = require('../services/webhook.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  embeddedSignupSchema,
  sendMessageSchema,
  sendTemplateSchema,
  listMessagesSchema,
  contactPhoneParamSchema,
  accountIdParamSchema,
  webhookVerifySchema,
} = require('../validations/whatsapp.validation');

// ────────────────────────────────────────────────
// Account Endpoints
// ────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/accounts/embedded-signup
 * Handles the Meta Embedded Signup flow — exchanges a code for WABA access.
 */
async function handleEmbeddedSignup(req, res) {
  const userId = req.headers['x-user-id'];
  const data = embeddedSignupSchema.parse(req.body);

  const result = await accountService.handleEmbeddedSignup(userId, data.code);

  return successResponse(
    res,
    { account: result },
    'WhatsApp account connected successfully',
    201
  );
}

/**
 * GET /api/v1/whatsapp/accounts
 * Lists all WhatsApp accounts for the authenticated user.
 */
async function listAccounts(req, res) {
  const userId = req.headers['x-user-id'];
  const accounts = await accountService.listAccounts(userId);
  return successResponse(res, { accounts }, 'WhatsApp accounts retrieved');
}

/**
 * GET /api/v1/whatsapp/accounts/:id
 * Gets a single WhatsApp account by ID for the authenticated user.
 */
async function getAccount(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = accountIdParamSchema.parse(req.params);

  const account = await accountService.getAccount(userId, id);
  return successResponse(res, { account }, 'WhatsApp account retrieved');
}

/**
 * DELETE /api/v1/whatsapp/accounts/:id
 * Deactivates (soft-disables) a WhatsApp account.
 */
async function deactivateAccount(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = accountIdParamSchema.parse(req.params);

  const account = await accountService.deactivateAccount(userId, id);
  return successResponse(res, { account }, 'WhatsApp account deactivated');
}

/**
 * GET /api/v1/whatsapp/accounts/:id/phone-numbers
 * Fetches phone numbers for a WhatsApp account from Meta API.
 */
async function getPhoneNumbers(req, res) {
  const userId = req.headers['x-user-id'];
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
  const userId = req.headers['x-user-id'];
  const data = sendMessageSchema.parse(req.body);

  const message = await messageService.sendMessage(userId, data);

  return successResponse(res, { message }, 'Message sent successfully', 201);
}

/**
 * POST /api/v1/whatsapp/send/template
 * Sends a pre-configured template message via WhatsApp.
 */
async function sendTemplateMessage(req, res) {
  const userId = req.headers['x-user-id'];
  const data = sendTemplateSchema.parse(req.body);

  const message = await messageService.sendTemplateMessage(userId, data);

  return successResponse(res, { message }, 'Template message sent successfully', 201);
}

/**
 * GET /api/v1/whatsapp/messages
 * Lists messages with filters and pagination.
 */
async function listMessages(req, res) {
  const userId = req.headers['x-user-id'];
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
  const userId = req.headers['x-user-id'];
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

  // Process webhook asynchronously (after response is sent)
  const kafkaProducer = req.app.locals.kafkaProducer || null;

  try {
    await webhookService.processWebhook(req.body, kafkaProducer);
  } catch (err) {
    console.error('[whatsapp-service] Webhook processing error:', err.message);
  }
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
  const userId = req.headers['x-user-id'];
  const data = sendMessageSchema.parse(req.body);

  const message = await messageService.sendMessage(userId, data);

  return successResponse(res, { message }, 'Message sent successfully', 201);
}

module.exports = {
  handleEmbeddedSignup,
  listAccounts,
  getAccount,
  deactivateAccount,
  getPhoneNumbers,
  sendMessage,
  sendTemplateMessage,
  listMessages,
  getConversation,
  verifyWebhook,
  processWebhook,
  developerSend,
};
