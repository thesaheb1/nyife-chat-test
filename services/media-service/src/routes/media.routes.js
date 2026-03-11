'use strict';

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { upload } = require('../middlewares/upload');
const { organizationResolver, asyncHandler } = require('@nyife/shared-middleware');

// User routes (authenticated via gateway x-user-id header)
router.use(organizationResolver);

router.post('/upload', upload.single('file'), asyncHandler(mediaController.uploadFile));
router.get('/', asyncHandler(mediaController.listMedia));
router.get('/:id', asyncHandler(mediaController.getFile));
router.get('/:id/download', asyncHandler(mediaController.downloadFile));
router.delete('/:id', asyncHandler(mediaController.deleteFile));

// Internal routes (called by whatsapp-service)
router.post('/upload-to-whatsapp', asyncHandler(mediaController.uploadToWhatsApp));
router.get('/whatsapp/:mediaId', asyncHandler(mediaController.downloadFromWhatsApp));

module.exports = router;
