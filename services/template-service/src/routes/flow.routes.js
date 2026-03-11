'use strict';

const express = require('express');
const { asyncHandler, requireActiveSubscription } = require('@nyife/shared-middleware');
const flowController = require('../controllers/flow.controller');

const router = express.Router();

router.post('/sync', requireActiveSubscription('sync flows'), asyncHandler(flowController.syncFlows));
router.post('/data-exchange', asyncHandler(flowController.handleDataExchange));

router.post('/', requireActiveSubscription('create flows'), asyncHandler(flowController.createFlow));
router.get('/', asyncHandler(flowController.listFlows));
router.get('/submissions/:submissionId', asyncHandler(flowController.getSubmission));
router.get('/:id', asyncHandler(flowController.getFlow));
router.put('/:id', requireActiveSubscription('update flows'), asyncHandler(flowController.updateFlow));
router.delete('/:id', requireActiveSubscription('delete flows'), asyncHandler(flowController.deleteFlow));
router.post('/:id/duplicate', requireActiveSubscription('duplicate flows'), asyncHandler(flowController.duplicateFlow));
router.post('/:id/save-to-meta', requireActiveSubscription('save flows to Meta'), asyncHandler(flowController.saveFlowToMeta));
router.post('/:id/publish', requireActiveSubscription('publish flows'), asyncHandler(flowController.publishFlow));
router.post('/:id/deprecate', requireActiveSubscription('deprecate flows'), asyncHandler(flowController.deprecateFlow));
router.get('/:id/submissions', asyncHandler(flowController.listSubmissions));

module.exports = router;
