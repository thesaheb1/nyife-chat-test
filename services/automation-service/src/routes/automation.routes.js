'use strict';

const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automation.controller');
const { organizationResolver, asyncHandler, requireActiveSubscription, rbac } = require('@nyife/shared-middleware');

router.use(organizationResolver);

// ────────────────────────────────────────────────
// Webhook routes (MUST come before /:id routes)
// ────────────────────────────────────────────────

// POST /webhooks — Create a new webhook
router.post('/webhooks', rbac('automations', 'create'), requireActiveSubscription('manage automation webhooks'), asyncHandler(automationController.createWebhook));

// GET /webhooks — List webhooks
router.get('/webhooks', rbac('automations', 'read'), asyncHandler(automationController.listWebhooks));

// GET /webhooks/:id — Get a single webhook
router.get('/webhooks/:id', rbac('automations', 'read'), asyncHandler(automationController.getWebhook));

// PUT /webhooks/:id — Update a webhook
router.put('/webhooks/:id', rbac('automations', 'update'), requireActiveSubscription('manage automation webhooks'), asyncHandler(automationController.updateWebhook));

// DELETE /webhooks/:id — Soft-delete a webhook
router.delete('/webhooks/:id', rbac('automations', 'delete'), requireActiveSubscription('manage automation webhooks'), asyncHandler(automationController.deleteWebhook));

// POST /webhooks/:id/test — Test a webhook
router.post('/webhooks/:id/test', rbac('automations', 'update'), requireActiveSubscription('test automation webhooks'), asyncHandler(automationController.testWebhook));

// ────────────────────────────────────────────────
// Automation CRUD routes
// ────────────────────────────────────────────────

// POST / — Create a new automation
router.post('/', rbac('automations', 'create'), requireActiveSubscription('create automations'), asyncHandler(automationController.createAutomation));

// GET / — List automations with filters and pagination
router.get('/', rbac('automations', 'read'), asyncHandler(automationController.listAutomations));

// GET /:id — Get a single automation
router.get('/:id', rbac('automations', 'read'), asyncHandler(automationController.getAutomation));

// PUT /:id — Update an automation
router.put('/:id', rbac('automations', 'update'), requireActiveSubscription('update automations'), asyncHandler(automationController.updateAutomation));

// DELETE /:id — Soft-delete an automation
router.delete('/:id', rbac('automations', 'delete'), requireActiveSubscription('delete automations'), asyncHandler(automationController.deleteAutomation));

// PUT /:id/status — Change automation status
router.put('/:id/status', rbac('automations', 'update'), requireActiveSubscription('update automations'), asyncHandler(automationController.updateAutomationStatus));

// GET /:id/logs — Get automation logs
router.get('/:id/logs', rbac('automations', 'read'), asyncHandler(automationController.getAutomationLogs));

module.exports = router;
