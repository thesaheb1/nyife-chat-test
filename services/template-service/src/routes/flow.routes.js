'use strict';

const express = require('express');
const { organizationResolver, asyncHandler, requireActiveSubscription, rbac } = require('@nyife/shared-middleware');
const flowController = require('../controllers/flow.controller');

const router = express.Router();
router.use(organizationResolver);

router.post('/sync', rbac('flows', 'update'), requireActiveSubscription('sync flows'), asyncHandler(flowController.syncFlows));
router.post('/data-exchange', asyncHandler(flowController.handleDataExchange));

router.post('/', rbac('flows', 'create'), requireActiveSubscription('create flows'), asyncHandler(flowController.createFlow));
router.get('/', rbac('flows', 'read'), asyncHandler(flowController.listFlows));
router.get('/submissions/:submissionId', rbac('flows', 'read'), asyncHandler(flowController.getSubmission));
router.get('/:id', rbac('flows', 'read'), asyncHandler(flowController.getFlow));
router.put('/:id', rbac('flows', 'update'), requireActiveSubscription('update flows'), asyncHandler(flowController.updateFlow));
router.delete('/:id', rbac('flows', 'delete'), requireActiveSubscription('delete flows'), asyncHandler(flowController.deleteFlow));
router.post('/:id/duplicate', rbac('flows', 'create'), requireActiveSubscription('duplicate flows'), asyncHandler(flowController.duplicateFlow));
router.post('/:id/save-to-meta', rbac('flows', 'update'), requireActiveSubscription('save flows to Meta'), asyncHandler(flowController.saveFlowToMeta));
router.post('/:id/publish', rbac('flows', 'update'), requireActiveSubscription('publish flows'), asyncHandler(flowController.publishFlow));
router.post('/:id/deprecate', rbac('flows', 'update'), requireActiveSubscription('deprecate flows'), asyncHandler(flowController.deprecateFlow));
router.get('/:id/submissions', rbac('flows', 'read'), asyncHandler(flowController.listSubmissions));

module.exports = router;
