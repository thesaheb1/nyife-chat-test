'use strict';

const emailService = require('../services/email.service');
const { successResponse } = require('@nyife/shared-utils');
const {
  sendEmailSchema,
  listEmailsSchema,
  emailIdSchema,
  createTemplateSchema,
  updateTemplateSchema,
  templateIdSchema,
  listTemplatesSchema,
} = require('../validations/email.validation');

// ────────────────────────────────────────────────
// Email Operations
// ────────────────────────────────────────────────

/**
 * POST /api/v1/emails/send
 * Sends an email using a template or raw HTML content.
 */
async function sendEmail(req, res) {
  const data = sendEmailSchema.parse(req.body);

  const emails = await emailService.sendEmail(data);

  return successResponse(res, { emails }, 'Email(s) processed successfully', 201);
}

/**
 * GET /api/v1/emails
 * Lists emails with pagination and filters.
 */
async function listEmails(req, res) {
  const filters = listEmailsSchema.parse(req.query);

  const { emails, meta } = await emailService.listEmails(filters);

  return successResponse(res, { emails }, 'Emails retrieved', 200, meta);
}

/**
 * GET /api/v1/emails/:id
 * Gets a single email record by ID.
 */
async function getEmail(req, res) {
  const { id } = emailIdSchema.parse(req.params);

  const email = await emailService.getEmail(id);

  return successResponse(res, { email }, 'Email retrieved');
}

/**
 * POST /api/v1/emails/:id/retry
 * Retries a failed email.
 */
async function retryEmail(req, res) {
  const { id } = emailIdSchema.parse(req.params);

  const email = await emailService.retryEmail(id);

  return successResponse(res, { email }, 'Email retry processed');
}

// ────────────────────────────────────────────────
// Template Management
// ────────────────────────────────────────────────

/**
 * POST /api/v1/emails/templates
 * Creates a new email template.
 */
async function createTemplate(req, res) {
  const data = createTemplateSchema.parse(req.body);

  const template = await emailService.createTemplate(data);

  return successResponse(res, { template }, 'Email template created successfully', 201);
}

/**
 * GET /api/v1/emails/templates
 * Lists email templates with pagination.
 */
async function listTemplates(req, res) {
  const filters = listTemplatesSchema.parse(req.query);

  const { templates, meta } = await emailService.listTemplates(filters);

  return successResponse(res, { templates }, 'Email templates retrieved', 200, meta);
}

/**
 * GET /api/v1/emails/templates/:id
 * Gets a single email template by ID.
 */
async function getTemplate(req, res) {
  const { id } = templateIdSchema.parse(req.params);

  const template = await emailService.getTemplate(id);

  return successResponse(res, { template }, 'Email template retrieved');
}

/**
 * PUT /api/v1/emails/templates/:id
 * Updates an email template.
 */
async function updateTemplate(req, res) {
  const { id } = templateIdSchema.parse(req.params);
  const data = updateTemplateSchema.parse(req.body);

  const template = await emailService.updateTemplate(id, data);

  return successResponse(res, { template }, 'Email template updated successfully');
}

/**
 * DELETE /api/v1/emails/templates/:id
 * Deletes an email template.
 */
async function deleteTemplate(req, res) {
  const { id } = templateIdSchema.parse(req.params);

  const result = await emailService.deleteTemplate(id);

  return successResponse(res, result, 'Email template deleted successfully');
}

module.exports = {
  sendEmail,
  listEmails,
  getEmail,
  retryEmail,
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
