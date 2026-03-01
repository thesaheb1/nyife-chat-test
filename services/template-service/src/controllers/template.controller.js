'use strict';

const templateService = require('../services/template.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesSchema,
  publishTemplateSchema,
  syncTemplatesSchema,
  templateIdSchema,
} = require('../validations/template.validation');

/**
 * POST /api/v1/templates
 * Create a new template in draft status.
 */
async function createTemplate(req, res) {
  const userId = req.headers['x-user-id'];
  const data = createTemplateSchema.parse(req.body);

  const template = await templateService.createTemplate(userId, data);

  return successResponse(res, { template }, 'Template created successfully', 201);
}

/**
 * GET /api/v1/templates
 * List templates with optional filtering and pagination.
 */
async function listTemplates(req, res) {
  const userId = req.headers['x-user-id'];
  const filters = listTemplatesSchema.parse(req.query);

  const { templates, meta } = await templateService.listTemplates(userId, filters);

  return successResponse(res, { templates }, 'Templates retrieved successfully', 200, meta);
}

/**
 * GET /api/v1/templates/:id
 * Get a single template by ID.
 */
async function getTemplate(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = templateIdSchema.parse(req.params);

  const template = await templateService.getTemplate(userId, id);

  return successResponse(res, { template }, 'Template retrieved successfully');
}

/**
 * PUT /api/v1/templates/:id
 * Update a draft or rejected template.
 */
async function updateTemplate(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = templateIdSchema.parse(req.params);
  const data = updateTemplateSchema.parse(req.body);

  const template = await templateService.updateTemplate(userId, id, data);

  return successResponse(res, { template }, 'Template updated successfully');
}

/**
 * DELETE /api/v1/templates/:id
 * Delete a template (soft delete locally, also deletes from Meta if published).
 */
async function deleteTemplate(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = templateIdSchema.parse(req.params);
  const accessToken = req.headers['x-wa-access-token'] || null;

  await templateService.deleteTemplate(userId, id, accessToken);

  return successResponse(res, null, 'Template deleted successfully');
}

/**
 * POST /api/v1/templates/:id/publish
 * Publish a draft template to Meta WhatsApp Cloud API.
 */
async function publishTemplate(req, res) {
  const userId = req.headers['x-user-id'];
  const { id } = templateIdSchema.parse(req.params);
  const body = publishTemplateSchema.parse(req.body || {});
  const accessToken = req.headers['x-wa-access-token'] || null;

  const template = await templateService.publishTemplate(
    userId,
    id,
    accessToken,
    body.waba_id || null
  );

  return successResponse(res, { template }, 'Template submitted to Meta for review', 200);
}

/**
 * POST /api/v1/templates/sync
 * Sync templates from Meta WhatsApp Cloud API for a given WABA ID.
 */
async function syncTemplates(req, res) {
  const userId = req.headers['x-user-id'];
  const { waba_id } = syncTemplatesSchema.parse(req.body);
  const accessToken = req.headers['x-wa-access-token'] || null;

  const result = await templateService.syncTemplates(userId, waba_id, accessToken);

  return successResponse(
    res,
    result,
    `Synced ${result.synced} templates from Meta (${result.created} created, ${result.updated} updated)`
  );
}

module.exports = {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  publishTemplate,
  syncTemplates,
};
