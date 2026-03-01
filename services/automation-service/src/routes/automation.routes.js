'use strict';

const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automation.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Webhook routes (MUST come before /:id routes)
// ────────────────────────────────────────────────

// POST /webhooks — Create a new webhook
router.post('/webhooks', asyncHandler(automationController.createWebhook));

// GET /webhooks — List webhooks
router.get('/webhooks', asyncHandler(automationController.listWebhooks));

// GET /webhooks/:id — Get a single webhook
router.get('/webhooks/:id', asyncHandler(automationController.getWebhook));

// PUT /webhooks/:id — Update a webhook
router.put('/webhooks/:id', asyncHandler(automationController.updateWebhook));

// DELETE /webhooks/:id — Soft-delete a webhook
router.delete('/webhooks/:id', asyncHandler(automationController.deleteWebhook));

// POST /webhooks/:id/test — Test a webhook
router.post('/webhooks/:id/test', asyncHandler(automationController.testWebhook));

// ────────────────────────────────────────────────
// Automation CRUD routes
// ────────────────────────────────────────────────

// POST / — Create a new automation
router.post('/', asyncHandler(automationController.createAutomation));

// GET / — List automations with filters and pagination
router.get('/', asyncHandler(automationController.listAutomations));

// GET /:id — Get a single automation
router.get('/:id', asyncHandler(automationController.getAutomation));

// PUT /:id — Update an automation
router.put('/:id', asyncHandler(automationController.updateAutomation));

// DELETE /:id — Soft-delete an automation
router.delete('/:id', asyncHandler(automationController.deleteAutomation));

// PUT /:id/status — Change automation status
router.put('/:id/status', asyncHandler(automationController.updateAutomationStatus));

// GET /:id/logs — Get automation logs
router.get('/:id/logs', asyncHandler(automationController.getAutomationLogs));

module.exports = router;
