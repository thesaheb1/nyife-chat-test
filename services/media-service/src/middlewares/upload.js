'use strict';

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { AppError } = require('@nyife/shared-utils');
const config = require('../config');

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/3gpp'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/amr', 'audio/mp3', 'audio/aac'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  sticker: ['image/webp'],
};

const ALL_ALLOWED = [
  ...ALLOWED_MIME_TYPES.image,
  ...ALLOWED_MIME_TYPES.video,
  ...ALLOWED_MIME_TYPES.audio,
  ...ALLOWED_MIME_TYPES.document,
  ...ALLOWED_MIME_TYPES.sticker,
];

function getFileType(mimetype) {
  for (const [type, mimes] of Object.entries(ALLOWED_MIME_TYPES)) {
    if (type === 'sticker') continue;
    if (mimes.includes(mimetype)) return type;
  }
  return 'other';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.headers['x-user-id'] || 'unknown';
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uploadDir = path.join(config.upload.rootDir, userId, yearMonth);

    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${uuidv4()}${ext}`;
    cb(null, storedName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALL_ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(AppError.badRequest(`File type ${file.mimetype} is not allowed`), false);
  }
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (largest allowed = document)

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = {
  upload,
  getFileType,
  ALLOWED_MIME_TYPES,
};
