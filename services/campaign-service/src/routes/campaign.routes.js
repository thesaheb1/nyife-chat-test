'use strict';

const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { asyncHandler, requireActiveSubscription } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Campaign CRUD routes
// ────────────────────────────────────────────────

// POST / — Create a new campaign
router.post('/', requireActiveSubscription('create campaigns'), asyncHandler(campaignController.createCampaign));

// GET / — List campaigns with filters and pagination
router.get('/', asyncHandler(campaignController.listCampaigns));

// GET /:id — Get a single campaign
router.get('/:id', asyncHandler(campaignController.getCampaign));

// PUT /:id — Update a draft campaign
router.put('/:id', requireActiveSubscription('update campaigns'), asyncHandler(campaignController.updateCampaign));

// DELETE /:id — Soft-delete a draft campaign
router.delete('/:id', requireActiveSubscription('delete campaigns'), asyncHandler(campaignController.deleteCampaign));

// ────────────────────────────────────────────────
// Campaign execution control routes
// ────────────────────────────────────────────────

// POST /:id/start — Start campaign execution
router.post('/:id/start', requireActiveSubscription('start campaigns'), asyncHandler(campaignController.startCampaign));

// POST /:id/pause — Pause a running campaign
router.post('/:id/pause', requireActiveSubscription('pause campaigns'), asyncHandler(campaignController.pauseCampaign));

// POST /:id/resume — Resume a paused campaign
router.post('/:id/resume', requireActiveSubscription('resume campaigns'), asyncHandler(campaignController.resumeCampaign));

// POST /:id/cancel — Cancel a campaign
router.post('/:id/cancel', requireActiveSubscription('cancel campaigns'), asyncHandler(campaignController.cancelCampaign));

// POST /:id/retry — Retry failed messages
router.post('/:id/retry', requireActiveSubscription('retry campaigns'), asyncHandler(campaignController.retryCampaign));

// ────────────────────────────────────────────────
// Campaign messages and analytics routes
// ────────────────────────────────────────────────

// GET /:id/messages — List campaign messages
router.get('/:id/messages', asyncHandler(campaignController.getCampaignMessages));

// GET /:id/analytics — Get campaign analytics
router.get('/:id/analytics', asyncHandler(campaignController.getCampaignAnalytics));

module.exports = router;
