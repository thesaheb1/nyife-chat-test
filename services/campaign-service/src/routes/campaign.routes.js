'use strict';

const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Campaign CRUD routes
// ────────────────────────────────────────────────

// POST / — Create a new campaign
router.post('/', asyncHandler(campaignController.createCampaign));

// GET / — List campaigns with filters and pagination
router.get('/', asyncHandler(campaignController.listCampaigns));

// GET /:id — Get a single campaign
router.get('/:id', asyncHandler(campaignController.getCampaign));

// PUT /:id — Update a draft campaign
router.put('/:id', asyncHandler(campaignController.updateCampaign));

// DELETE /:id — Soft-delete a draft campaign
router.delete('/:id', asyncHandler(campaignController.deleteCampaign));

// ────────────────────────────────────────────────
// Campaign execution control routes
// ────────────────────────────────────────────────

// POST /:id/start — Start campaign execution
router.post('/:id/start', asyncHandler(campaignController.startCampaign));

// POST /:id/pause — Pause a running campaign
router.post('/:id/pause', asyncHandler(campaignController.pauseCampaign));

// POST /:id/resume — Resume a paused campaign
router.post('/:id/resume', asyncHandler(campaignController.resumeCampaign));

// POST /:id/cancel — Cancel a campaign
router.post('/:id/cancel', asyncHandler(campaignController.cancelCampaign));

// POST /:id/retry — Retry failed messages
router.post('/:id/retry', asyncHandler(campaignController.retryCampaign));

// ────────────────────────────────────────────────
// Campaign messages and analytics routes
// ────────────────────────────────────────────────

// GET /:id/messages — List campaign messages
router.get('/:id/messages', asyncHandler(campaignController.getCampaignMessages));

// GET /:id/analytics — Get campaign analytics
router.get('/:id/analytics', asyncHandler(campaignController.getCampaignAnalytics));

module.exports = router;
