'use strict';

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authenticate, organizationResolver, asyncHandler, requireActiveSubscription, rbac } = require('@nyife/shared-middleware');
const { verifyWebhookSignature } = require('../middlewares/webhookSignature');

// ────────────────────────────────────────────────
// Webhook routes (PUBLIC — no auth, before auth middleware)
// ────────────────────────────────────────────────

// GET /webhook — Meta verification (challenge-response)
router.get('/webhook', asyncHandler(whatsappController.verifyWebhook));

// POST /webhook — Meta webhook events (signature verified by middleware)
router.post('/webhook', verifyWebhookSignature, asyncHandler(whatsappController.processWebhook));
router.post('/flows/data-exchange', asyncHandler(whatsappController.handleFlowDataExchange));
router.post('/internal/campaign-media/resolve', asyncHandler(whatsappController.resolveCampaignMedia));
router.post('/internal/account-product-catalogs', asyncHandler(whatsappController.getAccountProductCatalogs));

// ────────────────────────────────────────────────
// Account routes (authenticated)
// ────────────────────────────────────────────────
router.use(authenticate);
router.use(organizationResolver);

router.post(
  '/accounts/embedded-signup/preview',
  rbac('whatsapp', 'create'),
  requireActiveSubscription('connect WhatsApp accounts'),
  asyncHandler(whatsappController.previewEmbeddedSignup)
);

router.post(
  '/accounts/embedded-signup',
  rbac('whatsapp', 'create'),
  requireActiveSubscription('connect WhatsApp accounts'),
  asyncHandler(whatsappController.handleEmbeddedSignup)
);

router.get(
  '/accounts',
  rbac('whatsapp', 'read'),
  asyncHandler(whatsappController.listAccounts)
);

router.get(
  '/accounts/:id',
  rbac('whatsapp', 'read'),
  asyncHandler(whatsappController.getAccount)
);

router.delete(
  '/accounts/:id',
  rbac('whatsapp', 'delete'),
  requireActiveSubscription('disconnect WhatsApp accounts'),
  asyncHandler(whatsappController.deactivateAccount)
);

router.get(
  '/accounts/:id/health',
  rbac('whatsapp', 'update'),
  requireActiveSubscription('refresh WhatsApp account health'),
  asyncHandler(whatsappController.getAccountHealth)
);

router.post(
  '/accounts/:id/reconcile',
  rbac('whatsapp', 'update'),
  requireActiveSubscription('repair WhatsApp account connections'),
  asyncHandler(whatsappController.reconcileAccount)
);

router.get(
  '/accounts/:id/phone-numbers',
  rbac('whatsapp', 'read'),
  asyncHandler(whatsappController.getPhoneNumbers)
);

// ────────────────────────────────────────────────
// Message routes (authenticated)
// ────────────────────────────────────────────────

router.post(
  '/send',
  rbac('whatsapp', 'update'),
  asyncHandler(whatsappController.sendMessage)
);

router.post(
  '/send/template',
  rbac('whatsapp', 'update'),
  asyncHandler(whatsappController.sendTemplateMessage)
);

router.post(
  '/send/flow',
  rbac('whatsapp', 'update'),
  asyncHandler(whatsappController.sendFlowMessage)
);

router.get(
  '/messages',
  rbac('whatsapp', 'read'),
  asyncHandler(whatsappController.listMessages)
);

router.get(
  '/messages/:contactPhone',
  rbac('whatsapp', 'read'),
  asyncHandler(whatsappController.getConversation)
);

// ────────────────────────────────────────────────
// Developer API routes (authenticated via API token — same auth middleware)
// ────────────────────────────────────────────────

router.post(
  '/developer/send',
  rbac('developer', 'create'),
  asyncHandler(whatsappController.developerSend)
);

module.exports = router;
