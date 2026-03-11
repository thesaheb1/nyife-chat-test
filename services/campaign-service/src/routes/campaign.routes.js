'use strict';

const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { organizationResolver, asyncHandler, requireActiveSubscription, rbac } = require('@nyife/shared-middleware');

router.use(organizationResolver);

// ────────────────────────────────────────────────
// Campaign CRUD routes
// ────────────────────────────────────────────────

// POST / — Create a new campaign
router.post('/', rbac('campaigns', 'create'), requireActiveSubscription('create campaigns'), asyncHandler(campaignController.createCampaign));

// GET / — List campaigns with filters and pagination
router.get('/', rbac('campaigns', 'read'), asyncHandler(campaignController.listCampaigns));

// GET /:id — Get a single campaign
router.get('/:id', rbac('campaigns', 'read'), asyncHandler(campaignController.getCampaign));

// PUT /:id — Update a draft campaign
router.put('/:id', rbac('campaigns', 'update'), requireActiveSubscription('update campaigns'), asyncHandler(campaignController.updateCampaign));

// DELETE /:id — Soft-delete a draft campaign
router.delete('/:id', rbac('campaigns', 'delete'), requireActiveSubscription('delete campaigns'), asyncHandler(campaignController.deleteCampaign));

// ────────────────────────────────────────────────
// Campaign execution control routes
// ────────────────────────────────────────────────

// POST /:id/start — Start campaign execution
router.post('/:id/start', rbac('campaigns', 'update'), requireActiveSubscription('start campaigns'), asyncHandler(campaignController.startCampaign));

// POST /:id/pause — Pause a running campaign
router.post('/:id/pause', rbac('campaigns', 'update'), requireActiveSubscription('pause campaigns'), asyncHandler(campaignController.pauseCampaign));

// POST /:id/resume — Resume a paused campaign
router.post('/:id/resume', rbac('campaigns', 'update'), requireActiveSubscription('resume campaigns'), asyncHandler(campaignController.resumeCampaign));

// POST /:id/cancel — Cancel a campaign
router.post('/:id/cancel', rbac('campaigns', 'update'), requireActiveSubscription('cancel campaigns'), asyncHandler(campaignController.cancelCampaign));

// POST /:id/retry — Retry failed messages
router.post('/:id/retry', rbac('campaigns', 'update'), requireActiveSubscription('retry campaigns'), asyncHandler(campaignController.retryCampaign));

// ────────────────────────────────────────────────
// Campaign messages and analytics routes
// ────────────────────────────────────────────────

// GET /:id/messages — List campaign messages
router.get('/:id/messages', rbac('campaigns', 'read'), asyncHandler(campaignController.getCampaignMessages));

// GET /:id/analytics — Get campaign analytics
router.get('/:id/analytics', rbac('campaigns', 'read'), asyncHandler(campaignController.getCampaignAnalytics));

module.exports = router;
