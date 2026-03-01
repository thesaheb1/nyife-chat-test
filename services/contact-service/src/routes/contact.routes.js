'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../controllers/contact.controller');
const { authenticate, asyncHandler } = require('@nyife/shared-middleware');
const config = require('../config');

// Configure multer for CSV file upload (memory storage for streaming)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: (config.csvUploadMaxSizeMb || 10) * 1024 * 1024, // Default 10MB
  },
  fileFilter: (_req, file, cb) => {
    // Accept CSV files only
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    const allowedExtensions = ['.csv'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// ─── Tag Routes (MUST come before /:id to avoid "tags" being treated as an ID) ──

router.post('/tags', authenticate, asyncHandler(controller.createTag));
router.get('/tags', authenticate, asyncHandler(controller.listTags));
router.put('/tags/:id', authenticate, asyncHandler(controller.updateTag));
router.delete('/tags/:id', authenticate, asyncHandler(controller.deleteTag));

// ─── Group Routes (MUST come before /:id) ────────────────────────────────────

router.post('/groups', authenticate, asyncHandler(controller.createGroup));
router.get('/groups', authenticate, asyncHandler(controller.listGroups));
router.get('/groups/:id', authenticate, asyncHandler(controller.getGroup));
router.put('/groups/:id', authenticate, asyncHandler(controller.updateGroup));
router.delete('/groups/:id', authenticate, asyncHandler(controller.deleteGroup));
router.post('/groups/:id/members', authenticate, asyncHandler(controller.addGroupMembers));
router.delete('/groups/:id/members', authenticate, asyncHandler(controller.removeGroupMembers));

// ─── Bulk/Import Routes (MUST come before /:id) ──────────────────────────────

router.post('/bulk-delete', authenticate, asyncHandler(controller.bulkDeleteContacts));
router.post('/import/csv', authenticate, upload.single('file'), asyncHandler(controller.importCsv));

// ─── Contact CRUD Routes ─────────────────────────────────────────────────────

router.post('/', authenticate, asyncHandler(controller.createContact));
router.get('/', authenticate, asyncHandler(controller.listContacts));
router.get('/:id', authenticate, asyncHandler(controller.getContact));
router.put('/:id', authenticate, asyncHandler(controller.updateContact));
router.delete('/:id', authenticate, asyncHandler(controller.deleteContact));

// ─── Contact Tag Management Routes ───────────────────────────────────────────

router.post('/:id/tags', authenticate, asyncHandler(controller.addTagsToContact));
router.delete('/:id/tags/:tagId', authenticate, asyncHandler(controller.removeTagFromContact));

module.exports = router;
