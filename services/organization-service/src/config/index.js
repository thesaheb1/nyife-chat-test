'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.ORGANIZATION_SERVICE_PORT || '3011', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
};
