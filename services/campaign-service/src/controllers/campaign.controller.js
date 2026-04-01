'use strict';

const campaignService = require('../services/campaign.service');
const { successResponse } = require('@nyife/shared-utils');
const { resolveCampaignRequestContext } = require('../helpers/requestContext');
const {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsSchema,
  campaignIdSchema,
  listCampaignMessagesSchema,
  retryCampaignSchema,
} = require('../validations/campaign.validation');

// ────────────────────────────────────────────────
// Campaign CRUD
// ────────────────────────────────────────────────

/**
 * POST /api/v1/campaigns
 * Creates a new campaign in draft status.
 */
async function createCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const data = createCampaignSchema.parse(req.body);

  const campaign = await campaignService.createCampaign(requestContext, data);

  return successResponse(res, { campaign }, 'Campaign created successfully', 201);
}

/**
 * GET /api/v1/campaigns
 * Lists campaigns for the authenticated user with pagination and filters.
 */
async function listCampaigns(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const filters = listCampaignsSchema.parse(req.query);

  const { campaigns, meta } = await campaignService.listCampaigns(requestContext, filters);

  return successResponse(res, { campaigns }, 'Campaigns retrieved', 200, meta);
}

/**
 * GET /api/v1/campaigns/:id
 * Gets a single campaign by ID.
 */
async function getCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);

  const campaign = await campaignService.getCampaign(requestContext, id);

  return successResponse(res, { campaign }, 'Campaign retrieved');
}

/**
 * PUT /api/v1/campaigns/:id
 * Updates a draft campaign.
 */
async function updateCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);
  const data = updateCampaignSchema.parse(req.body);

  const campaign = await campaignService.updateCampaign(requestContext, id, data);

  return successResponse(res, { campaign }, 'Campaign updated successfully');
}

/**
 * DELETE /api/v1/campaigns/:id
 * Soft-deletes a draft campaign.
 */
async function deleteCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);

  const result = await campaignService.deleteCampaign(requestContext, id);

  return successResponse(res, result, 'Campaign deleted successfully');
}

// ────────────────────────────────────────────────
// Campaign Execution Controls
// ────────────────────────────────────────────────

/**
 * POST /api/v1/campaigns/:id/start
 * Starts campaign execution: resolves contacts, publishes to Kafka.
 */
async function startCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);
  const kafkaProducer = req.app.locals.kafkaProducer;

  const campaign = await campaignService.startCampaign(requestContext, id, kafkaProducer);

  return successResponse(res, { campaign }, 'Campaign started successfully');
}

/**
 * POST /api/v1/campaigns/:id/pause
 * Pauses a running campaign.
 */
async function pauseCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);

  const campaign = await campaignService.pauseCampaign(requestContext, id);

  return successResponse(res, { campaign }, 'Campaign paused successfully');
}

/**
 * POST /api/v1/campaigns/:id/resume
 * Resumes a paused campaign.
 */
async function resumeCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);
  const kafkaProducer = req.app.locals.kafkaProducer;

  const campaign = await campaignService.resumeCampaign(requestContext, id, kafkaProducer);

  return successResponse(res, { campaign }, 'Campaign resumed successfully');
}

/**
 * POST /api/v1/campaigns/:id/cancel
 * Cancels a campaign and marks pending messages as failed.
 */
async function cancelCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);

  const campaign = await campaignService.cancelCampaign(requestContext, id);

  return successResponse(res, { campaign }, 'Campaign cancelled successfully');
}

/**
 * POST /api/v1/campaigns/:id/retry
 * Retries failed messages in a campaign.
 */
async function retryCampaign(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = retryCampaignSchema.parse(req.params);
  const kafkaProducer = req.app.locals.kafkaProducer;

  const campaign = await campaignService.retryCampaign(requestContext, id, kafkaProducer);

  return successResponse(res, { campaign }, 'Campaign retry initiated successfully');
}

// ────────────────────────────────────────────────
// Campaign Messages & Analytics
// ────────────────────────────────────────────────

/**
 * GET /api/v1/campaigns/:id/messages
 * Lists messages for a campaign with pagination.
 */
async function getCampaignMessages(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);
  const filters = listCampaignMessagesSchema.parse(req.query);

  const { messages, meta } = await campaignService.getCampaignMessages(requestContext, id, filters);

  return successResponse(res, { messages }, 'Campaign messages retrieved', 200, meta);
}

/**
 * GET /api/v1/campaigns/:id/analytics
 * Gets detailed analytics for a campaign.
 */
async function getCampaignAnalytics(req, res) {
  const requestContext = resolveCampaignRequestContext(req);
  const { id } = campaignIdSchema.parse(req.params);

  const analytics = await campaignService.getCampaignAnalytics(requestContext, id);

  return successResponse(res, { analytics }, 'Campaign analytics retrieved');
}

module.exports = {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryCampaign,
  getCampaignMessages,
  getCampaignAnalytics,
};
