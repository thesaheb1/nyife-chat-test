'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const rootEnvPath = path.resolve(__dirname, '../../../../.env');
let parsedRootEnv = {};
if (fs.existsSync(rootEnvPath)) {
  parsedRootEnv = dotenv.parse(fs.readFileSync(rootEnvPath));
  for (const [key, value] of Object.entries(parsedRootEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function readEnv(...keys) {
  for (const key of keys) {
    const processValue = process.env[key];
    if (processValue !== undefined && processValue !== '') {
      return processValue;
    }

    const rootValue = parsedRootEnv[key];
    if (rootValue !== undefined && rootValue !== '') {
      return rootValue;
    }
  }

  return undefined;
}

const smtpPort = parseInt(readEnv('SMTP_PORT') || '587', 10);
const smtpSecure =
  readEnv('SMTP_SECURE') === 'true'
  || smtpPort === 465;

module.exports = {
  port: parseInt(process.env.EMAIL_SERVICE_PORT || '3013', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  },
  smtp: {
    host: readEnv('SMTP_HOST') || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: readEnv('SMTP_USER') || '',
      pass: readEnv('SMTP_PASS') || '',
    },
    from: {
      name: readEnv('SMTP_FROM_NAME') || 'Nyife',
      email: readEnv('SMTP_FROM_EMAIL') || 'noreply@nyife.com',
    },
  },
};
