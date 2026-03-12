'use strict';

const multer = require('multer');
const { AppError } = require('@nyife/shared-middleware');

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(AppError.badRequest('Only JPG, PNG, or WEBP avatar images are allowed.'), false);
  },
});

module.exports = {
  avatarUpload,
};
