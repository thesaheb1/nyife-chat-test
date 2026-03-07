'use strict';

const express = require('express');
const { asyncHandler } = require('@nyife/shared-middleware');
const flowController = require('../controllers/flow.controller');

const router = express.Router();

router.post('/sync', asyncHandler(flowController.syncFlows));
router.post('/data-exchange', asyncHandler(flowController.handleDataExchange));

router.post('/', asyncHandler(flowController.createFlow));
router.get('/', asyncHandler(flowController.listFlows));
router.get('/submissions/:submissionId', asyncHandler(flowController.getSubmission));
router.get('/:id', asyncHandler(flowController.getFlow));
router.put('/:id', asyncHandler(flowController.updateFlow));
router.delete('/:id', asyncHandler(flowController.deleteFlow));
router.post('/:id/duplicate', asyncHandler(flowController.duplicateFlow));
router.post('/:id/save-to-meta', asyncHandler(flowController.saveFlowToMeta));
router.post('/:id/publish', asyncHandler(flowController.publishFlow));
router.post('/:id/deprecate', asyncHandler(flowController.deprecateFlow));
router.get('/:id/submissions', asyncHandler(flowController.listSubmissions));

module.exports = router;
