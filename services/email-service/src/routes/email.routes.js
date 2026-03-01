'use strict';

const express = require('express');
const router = express.Router();
const emailController = require('../controllers/email.controller');
const { asyncHandler } = require('@nyife/shared-middleware');

// ────────────────────────────────────────────────
// Email sending and management routes
// ────────────────────────────────────────────────

// POST /send — Send an email
router.post('/send', asyncHandler(emailController.sendEmail));

// GET / — List emails with filters and pagination
router.get('/', asyncHandler(emailController.listEmails));

// ────────────────────────────────────────────────
// Template management routes (BEFORE /:id to avoid conflicts)
// ────────────────────────────────────────────────

// GET /templates — List email templates
router.get('/templates', asyncHandler(emailController.listTemplates));

// POST /templates — Create a new email template
router.post('/templates', asyncHandler(emailController.createTemplate));

// GET /templates/:id — Get a single email template
router.get('/templates/:id', asyncHandler(emailController.getTemplate));

// PUT /templates/:id — Update an email template
router.put('/templates/:id', asyncHandler(emailController.updateTemplate));

// DELETE /templates/:id — Delete an email template
router.delete('/templates/:id', asyncHandler(emailController.deleteTemplate));

// ────────────────────────────────────────────────
// Single email routes
// ────────────────────────────────────────────────

// GET /:id — Get a single email record
router.get('/:id', asyncHandler(emailController.getEmail));

// POST /:id/retry — Retry a failed email
router.post('/:id/retry', asyncHandler(emailController.retryEmail));

module.exports = router;
