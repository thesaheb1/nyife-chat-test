'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.USER_SERVICE_PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
};
