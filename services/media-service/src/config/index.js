'use strict';

require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.MEDIA_SERVICE_PORT || '3017', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  meta: {
    apiVersion: process.env.META_API_VERSION || 'v20.0',
    baseUrl: process.env.META_API_BASE_URL || 'https://graph.facebook.com/v20.0',
  },
  upload: {
    rootDir: process.env.MEDIA_UPLOAD_DIR || path.resolve(__dirname, '../../../../uploads'),
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE || '5242880', 10),
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE || '16777216', 10),
    maxAudioSize: parseInt(process.env.MAX_AUDIO_SIZE || '16777216', 10),
    maxDocumentSize: parseInt(process.env.MAX_DOCUMENT_SIZE || '104857600', 10),
  },
};
