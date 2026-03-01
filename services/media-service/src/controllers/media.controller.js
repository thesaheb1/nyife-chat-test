'use strict';

const mediaService = require('../services/media.service');
const { successResponse } = require('@nyife/shared-utils');
const { AppError } = require('@nyife/shared-utils');
const {
  uploadToWhatsAppSchema,
  listMediaSchema,
  mediaIdParamSchema,
  whatsappMediaIdParamSchema,
} = require('../validations/media.validation');

async function uploadFile(req, res) {
  if (!req.file) {
    throw AppError.badRequest('No file uploaded');
  }

  const userId = req.headers['x-user-id'];
  if (!userId) {
    throw AppError.unauthorized('User ID is required');
  }

  const record = await mediaService.createFileRecord(userId, req.file);

  return successResponse(res, record, 'File uploaded successfully', 201);
}

async function listMedia(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    throw AppError.unauthorized('User ID is required');
  }

  const filters = listMediaSchema.parse(req.query);
  const result = await mediaService.listMedia(userId, filters);

  return successResponse(res, result.files, 'Media files retrieved', 200, result.meta);
}

async function getFile(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    throw AppError.unauthorized('User ID is required');
  }

  const { id } = mediaIdParamSchema.parse(req.params);
  const file = await mediaService.getFileById(userId, id);

  return successResponse(res, file, 'File details retrieved');
}

async function downloadFile(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    throw AppError.unauthorized('User ID is required');
  }

  const { id } = mediaIdParamSchema.parse(req.params);
  const { file, fullPath } = await mediaService.getFilePath(userId, id);

  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
  res.setHeader('Content-Length', file.size);

  return res.sendFile(fullPath);
}

async function deleteFile(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    throw AppError.unauthorized('User ID is required');
  }

  const { id } = mediaIdParamSchema.parse(req.params);
  await mediaService.deleteFile(userId, id);

  return successResponse(res, null, 'File deleted successfully');
}

async function uploadToWhatsApp(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    throw AppError.unauthorized('User ID is required');
  }

  const { file_id, phone_number_id } = uploadToWhatsAppSchema.parse(req.body);

  // Access token should be passed by the calling service (whatsapp-service) in internal header
  const accessToken = req.headers['x-wa-access-token'];
  if (!accessToken) {
    throw AppError.badRequest('WhatsApp access token is required (x-wa-access-token header)');
  }

  const result = await mediaService.uploadToWhatsApp(userId, file_id, phone_number_id, accessToken);

  return successResponse(res, result, 'File uploaded to WhatsApp successfully');
}

async function downloadFromWhatsApp(req, res) {
  const { mediaId } = whatsappMediaIdParamSchema.parse(req.params);

  const accessToken = req.headers['x-wa-access-token'];
  if (!accessToken) {
    throw AppError.badRequest('WhatsApp access token is required (x-wa-access-token header)');
  }

  const { stream, mimeType, fileSize } = await mediaService.downloadFromWhatsApp(mediaId, accessToken);

  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  if (fileSize) {
    res.setHeader('Content-Length', fileSize);
  }

  stream.pipe(res);
}

module.exports = {
  uploadFile,
  listMedia,
  getFile,
  downloadFile,
  deleteFile,
  uploadToWhatsApp,
  downloadFromWhatsApp,
};
