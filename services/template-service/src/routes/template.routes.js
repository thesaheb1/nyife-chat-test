'use strict';

const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');
const { organizationResolver, asyncHandler, requireActiveSubscription, rbac } = require('@nyife/shared-middleware');

// All template routes are protected — the API gateway injects x-user-id after JWT validation.
// The gateway must ensure the user is authenticated before routing to this service.
router.use(organizationResolver);

// Sync must be defined BEFORE the :id param routes to avoid "sync" being captured as an id
router.post('/sync', rbac('templates', 'update'), requireActiveSubscription('sync templates'), asyncHandler(templateController.syncTemplates));

// CRUD routes
router.post('/', rbac('templates', 'create'), requireActiveSubscription('create templates'), asyncHandler(templateController.createTemplate));
router.get('/', rbac('templates', 'read'), asyncHandler(templateController.listTemplates));
router.get('/:id', rbac('templates', 'read'), asyncHandler(templateController.getTemplate));
router.put('/:id', rbac('templates', 'update'), requireActiveSubscription('update templates'), asyncHandler(templateController.updateTemplate));
router.delete('/:id', rbac('templates', 'delete'), requireActiveSubscription('delete templates'), asyncHandler(templateController.deleteTemplate));

// Publishing
router.post('/:id/publish', rbac('templates', 'update'), requireActiveSubscription('publish templates'), asyncHandler(templateController.publishTemplate));

module.exports = router;
