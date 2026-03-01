'use strict';

const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// All template routes are protected — the API gateway injects x-user-id after JWT validation.
// The gateway must ensure the user is authenticated before routing to this service.

// Sync must be defined BEFORE the :id param routes to avoid "sync" being captured as an id
router.post('/sync', asyncHandler(templateController.syncTemplates));

// CRUD routes
router.post('/', asyncHandler(templateController.createTemplate));
router.get('/', asyncHandler(templateController.listTemplates));
router.get('/:id', asyncHandler(templateController.getTemplate));
router.put('/:id', asyncHandler(templateController.updateTemplate));
router.delete('/:id', asyncHandler(templateController.deleteTemplate));

// Publishing
router.post('/:id/publish', asyncHandler(templateController.publishTemplate));

module.exports = router;
