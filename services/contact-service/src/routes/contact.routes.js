'use strict';

const express = require('express');
const multer = require('multer');
const router = express.Router();
const controller = require('../controllers/contact.controller');
const {
  authenticate,
  organizationResolver,
  asyncHandler,
  requireActiveSubscription,
  rbac,
} = require('@nyife/shared-middleware');
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

router.use(authenticate);
router.use(organizationResolver);

// ─── Tag Routes (MUST come before /:id to avoid "tags" being treated as an ID) ──

router.post('/tags', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.createTag));
router.get('/tags', rbac('contacts', 'read'), asyncHandler(controller.listTags));
router.post('/tags/bulk-assign', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.bulkAssignTagsToContacts));
router.delete('/tags/bulk-assign', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.bulkRemoveTagsFromContacts));
router.put('/tags/:id', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.updateTag));
router.delete('/tags/:id', rbac('contacts', 'delete'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.deleteTag));

// ─── Group Routes (MUST come before /:id) ────────────────────────────────────

router.post('/groups', rbac('contacts', 'create'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.createGroup));
router.get('/groups', rbac('contacts', 'read'), asyncHandler(controller.listGroups));
router.post('/groups/import/csv', rbac('contacts', 'create'), requireActiveSubscription('import contact groups'), upload.single('file'), asyncHandler(controller.importGroupsCsv));
router.post('/groups/bulk-memberships', rbac('contacts', 'update'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.bulkAssignContactsToGroups));
router.delete('/groups/bulk-memberships', rbac('contacts', 'update'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.bulkRemoveContactsFromGroups));
router.get('/groups/:id', rbac('contacts', 'read'), asyncHandler(controller.getGroup));
router.put('/groups/:id', rbac('contacts', 'update'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.updateGroup));
router.delete('/groups/:id', rbac('contacts', 'delete'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.deleteGroup));
router.post('/groups/:id/members', rbac('contacts', 'update'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.addGroupMembers));
router.delete('/groups/:id/members', rbac('contacts', 'update'), requireActiveSubscription('manage contact groups'), asyncHandler(controller.removeGroupMembers));

// ─── Bulk/Import Routes (MUST come before /:id) ──────────────────────────────

router.post('/bulk-delete', rbac('contacts', 'delete'), requireActiveSubscription('delete contacts'), asyncHandler(controller.bulkDeleteContacts));
router.get('/import/csv/sample/contacts', rbac('contacts', 'read'), asyncHandler(controller.downloadContactCsvSample));
router.get('/import/csv/sample/groups', rbac('contacts', 'read'), asyncHandler(controller.downloadGroupCsvSample));
router.post('/import/csv', rbac('contacts', 'create'), requireActiveSubscription('import contacts'), upload.single('file'), asyncHandler(controller.importCsv));
router.post('/add-tag', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.addTagByPhone));

// ─── Contact CRUD Routes ─────────────────────────────────────────────────────

router.post('/', rbac('contacts', 'create'), requireActiveSubscription('create contacts'), asyncHandler(controller.createContact));
router.get('/', rbac('contacts', 'read'), asyncHandler(controller.listContacts));
router.get('/:id', rbac('contacts', 'read'), asyncHandler(controller.getContact));
router.put('/:id', rbac('contacts', 'update'), requireActiveSubscription('update contacts'), asyncHandler(controller.updateContact));
router.delete('/:id', rbac('contacts', 'delete'), requireActiveSubscription('delete contacts'), asyncHandler(controller.deleteContact));

// ─── Contact Tag Management Routes ───────────────────────────────────────────

router.post('/:id/tags', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.addTagsToContact));
router.delete('/:id/tags/:tagId', rbac('contacts', 'update'), requireActiveSubscription('manage contact tags'), asyncHandler(controller.removeTagFromContact));

module.exports = router;
