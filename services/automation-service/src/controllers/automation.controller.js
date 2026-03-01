'use strict';

const automationService = require('../services/automation.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  createAutomationSchema,
  updateAutomationSchema,
  updateAutomationStatusSchema,
  listAutomationsSchema,
  automationIdSchema,
  listLogsSchema,
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdSchema,
} = require('../validations/automation.validation');

// ────────────────────────────────────────────────
// Automation CRUD
// ────────────────────────────────────────────────

/**
 * POST /api/v1/automations
 * Creates a new automation in draft status.
 */
async function createAutomation(req, res) {
  const userId = req.headers['x-user-id'];
  const data = createAutomationSchema.parse(req.body);

  const automation = await automationService.createAutomation(userId, data);

  return successResponse(res, { automation }, 'Automation created successfully', 201);
}

/**
 * GET /api/v1/automations
 * Lists automations for the authenticated user with pagination and filters.
 */
async function listAutomations(req, res) {
  const userId = req.headers['x-user-id'];
  const filters = listAutomationsSchema.parse(req.query);

  const { automations, meta } = await automationService.listAutomations(userId, filters);

  return successResponse(res, { automations }, 'Automations retrieved', 200, meta);
}

/**
 * GET /api/v1/automations/:id
 * Gets a single automation by ID.
 */
async function getAutomation(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = automationIdSchema.parse(req.params);

  const automation = await automationService.getAutomation(userId, id);

  return successResponse(res, { automation }, 'Automation retrieved');
}

/**
 * PUT /api/v1/automations/:id
 * Updates an automation.
 */
async function updateAutomation(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = automationIdSchema.parse(req.params);
  const data = updateAutomationSchema.parse(req.body);

  const automation = await automationService.updateAutomation(userId, id, data);

  return successResponse(res, { automation }, 'Automation updated successfully');
}

/**
 * DELETE /api/v1/automations/:id
 * Soft-deletes an automation.
 */
async function deleteAutomation(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = automationIdSchema.parse(req.params);

  const result = await automationService.deleteAutomation(userId, id);

  return successResponse(res, result, 'Automation deleted successfully');
}

/**
 * PUT /api/v1/automations/:id/status
 * Changes automation status (active/inactive/draft).
 */
async function updateAutomationStatus(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = automationIdSchema.parse(req.params);
  const { status } = updateAutomationStatusSchema.parse(req.body);

  const automation = await automationService.updateAutomationStatus(userId, id, status);

  return successResponse(res, { automation }, 'Automation status updated successfully');
}

/**
 * GET /api/v1/automations/:id/logs
 * Gets paginated logs for a specific automation.
 */
async function getAutomationLogs(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = automationIdSchema.parse(req.params);
  const filters = listLogsSchema.parse(req.query);

  const { logs, meta } = await automationService.getAutomationLogs(userId, id, filters);

  return successResponse(res, { logs }, 'Automation logs retrieved', 200, meta);
}

// ────────────────────────────────────────────────
// Webhook CRUD
// ────────────────────────────────────────────────

/**
 * POST /api/v1/automations/webhooks
 * Creates a new webhook.
 */
async function createWebhook(req, res) {
  const userId = req.headers['x-user-id'];
  const data = createWebhookSchema.parse(req.body);

  const webhook = await automationService.createWebhook(userId, data);

  return successResponse(res, { webhook }, 'Webhook created successfully', 201);
}

/**
 * GET /api/v1/automations/webhooks
 * Lists webhooks for the authenticated user.
 */
async function listWebhooks(req, res) {
  const userId = req.headers['x-user-id'];
  const filters = listLogsSchema.parse(req.query);

  const { webhooks, meta } = await automationService.listWebhooks(userId, filters);

  return successResponse(res, { webhooks }, 'Webhooks retrieved', 200, meta);
}

/**
 * GET /api/v1/automations/webhooks/:id
 * Gets a single webhook by ID.
 */
async function getWebhook(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = webhookIdSchema.parse(req.params);

  const webhook = await automationService.getWebhook(userId, id);

  return successResponse(res, { webhook }, 'Webhook retrieved');
}

/**
 * PUT /api/v1/automations/webhooks/:id
 * Updates a webhook.
 */
async function updateWebhook(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = webhookIdSchema.parse(req.params);
  const data = updateWebhookSchema.parse(req.body);

  const webhook = await automationService.updateWebhook(userId, id, data);

  return successResponse(res, { webhook }, 'Webhook updated successfully');
}

/**
 * DELETE /api/v1/automations/webhooks/:id
 * Soft-deletes a webhook.
 */
async function deleteWebhook(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = webhookIdSchema.parse(req.params);

  const result = await automationService.deleteWebhook(userId, id);

  return successResponse(res, result, 'Webhook deleted successfully');
}

/**
 * POST /api/v1/automations/webhooks/:id/test
 * Tests a webhook by sending a test payload.
 */
async function testWebhook(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = webhookIdSchema.parse(req.params);

  const result = await automationService.testWebhook(userId, id);

  return successResponse(res, result, 'Webhook test completed successfully');
}

module.exports = {
  createAutomation,
  listAutomations,
  getAutomation,
  updateAutomation,
  deleteAutomation,
  updateAutomationStatus,
  getAutomationLogs,
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
};
