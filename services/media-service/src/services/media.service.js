'use strict';

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { Op } = require('sequelize');
const { MediaFile } = require('../models');
const config = require('../config');
const { AppError } = require('@nyife/shared-utils');
const { getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const { getFileType } = require('../middlewares/upload');

const SIZE_LIMITS = {
  image: config.upload.maxImageSize,
  video: config.upload.maxVideoSize,
  audio: config.upload.maxAudioSize,
  document: config.upload.maxDocumentSize,
  other: config.upload.maxDocumentSize,
};

async function createFileRecord(userId, file) {
  const fileType = getFileType(file.mimetype);
  const sizeLimit = SIZE_LIMITS[fileType];

  if (file.size > sizeLimit) {
    // Remove the uploaded file since it exceeds the type-specific limit
    fs.unlink(file.path, () => {});
    throw AppError.badRequest(
      `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds limit of ${(sizeLimit / (1024 * 1024)).toFixed(0)}MB for ${fileType} files`
    );
  }

  const relativePath = path.relative(config.upload.rootDir, file.path).replace(/\\/g, '/');

  const record = await MediaFile.create({
    user_id: userId,
    original_name: file.originalname,
    stored_name: file.filename,
    mime_type: file.mimetype,
    size: file.size,
    path: relativePath,
    type: fileType,
    meta: null,
  });

  return record;
}

async function listMedia(userId, filters) {
  const { page, limit, type, search } = filters;
  const { offset, limit: queryLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (type) {
    where.type = type;
  }

  if (search) {
    where.original_name = { [Op.like]: `%${search}%` };
  }

  const { count, rows } = await MediaFile.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: queryLimit,
  });

  return {
    files: rows,
    meta: getPaginationMeta(count, page, queryLimit),
  };
}

async function getFileById(userId, fileId) {
  const file = await MediaFile.findOne({
    where: { id: fileId, user_id: userId },
  });

  if (!file) {
    throw AppError.notFound('File not found');
  }

  return file;
}

async function getFilePath(userId, fileId) {
  const file = await getFileById(userId, fileId);
  const fullPath = path.join(config.upload.rootDir, file.path);

  if (!fs.existsSync(fullPath)) {
    throw AppError.notFound('File not found on disk');
  }

  return { file, fullPath };
}

async function deleteFile(userId, fileId) {
  const file = await getFileById(userId, fileId);
  await file.destroy(); // soft delete
  return file;
}

async function uploadToWhatsApp(userId, fileId, phoneNumberId, accessToken) {
  const file = await getFileById(userId, fileId);
  const fullPath = path.join(config.upload.rootDir, file.path);

  if (!fs.existsSync(fullPath)) {
    throw AppError.notFound('File not found on disk');
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(fullPath), {
    filename: file.original_name,
    contentType: file.mime_type,
  });
  formData.append('messaging_product', 'whatsapp');

  const response = await axios.post(
    `${config.meta.baseUrl}/${phoneNumberId}/media`,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${accessToken}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  const mediaId = response.data.id;

  await file.update({ whatsapp_media_id: mediaId });

  return {
    file_id: file.id,
    whatsapp_media_id: mediaId,
  };
}

async function downloadFromWhatsApp(whatsappMediaId, accessToken) {
  // Step 1: Get the media URL from Meta
  const metaResponse = await axios.get(
    `${config.meta.baseUrl}/${whatsappMediaId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const { url, mime_type, file_size } = metaResponse.data;

  // Step 2: Download the actual binary
  const fileResponse = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'stream',
  });

  return {
    stream: fileResponse.data,
    mimeType: mime_type,
    fileSize: file_size,
  };
}

module.exports = {
  createFileRecord,
  listMedia,
  getFileById,
  getFilePath,
  deleteFile,
  uploadToWhatsApp,
  downloadFromWhatsApp,
};
