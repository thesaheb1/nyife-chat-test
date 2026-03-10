'use strict';

const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authenticate } = require('@nyife/shared-middleware');
const { asyncHandler } = require('@nyife/shared-middleware');
const { verifyWebhookSignature } = require('../middlewares/webhookSignature');

// ────────────────────────────────────────────────
// Webhook routes (PUBLIC — no auth, before auth middleware)
// ────────────────────────────────────────────────

// GET /webhook — Meta verification (challenge-response)
router.get('/webhook', asyncHandler(whatsappController.verifyWebhook));

// POST /webhook — Meta webhook events (signature verified by middleware)
router.post('/webhook', verifyWebhookSignature, asyncHandler(whatsappController.processWebhook));
router.post('/flows/data-exchange', asyncHandler(whatsappController.handleFlowDataExchange));

// ────────────────────────────────────────────────
// Account routes (authenticated)
// ────────────────────────────────────────────────
router.post(
  '/accounts/embedded-signup/preview',
  authenticate,
  asyncHandler(whatsappController.previewEmbeddedSignup)
);

router.post(
  '/accounts/embedded-signup',
  authenticate,
  asyncHandler(whatsappController.handleEmbeddedSignup)
);

router.get(
  '/accounts',
  authenticate,
  asyncHandler(whatsappController.listAccounts)
);

router.get(
  '/accounts/:id',
  authenticate,
  asyncHandler(whatsappController.getAccount)
);

router.delete(
  '/accounts/:id',
  authenticate,
  asyncHandler(whatsappController.deactivateAccount)
);

router.get(
  '/accounts/:id/health',
  authenticate,
  asyncHandler(whatsappController.getAccountHealth)
);

router.post(
  '/accounts/:id/reconcile',
  authenticate,
  asyncHandler(whatsappController.reconcileAccount)
);

router.get(
  '/accounts/:id/phone-numbers',
  authenticate,
  asyncHandler(whatsappController.getPhoneNumbers)
);

// ────────────────────────────────────────────────
// Message routes (authenticated)
// ────────────────────────────────────────────────

router.post(
  '/send',
  authenticate,
  asyncHandler(whatsappController.sendMessage)
);

router.post(
  '/send/template',
  authenticate,
  asyncHandler(whatsappController.sendTemplateMessage)
);

router.post(
  '/send/flow',
  authenticate,
  asyncHandler(whatsappController.sendFlowMessage)
);

router.get(
  '/messages',
  authenticate,
  asyncHandler(whatsappController.listMessages)
);

router.get(
  '/messages/:contactPhone',
  authenticate,
  asyncHandler(whatsappController.getConversation)
);

// ────────────────────────────────────────────────
// Developer API routes (authenticated via API token — same auth middleware)
// ────────────────────────────────────────────────

router.post(
  '/developer/send',
  authenticate,
  asyncHandler(whatsappController.developerSend)
);

module.exports = router;
