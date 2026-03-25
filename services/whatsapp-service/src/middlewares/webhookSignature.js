'use strict';

const crypto = require('crypto');
const config = require('../config');

/**
 * Express middleware that verifies the X-Hub-Signature-256 header on incoming
 * Meta webhook requests.
 *
 * Meta signs each webhook POST payload using HMAC-SHA256 with the app secret.
 * This middleware compares the signature header against a locally computed hash
 * to ensure the payload is authentic and has not been tampered with.
 *
 * IMPORTANT: This middleware requires that the raw request body has been captured
 * before JSON parsing. Use the following in app.js for the webhook route:
 *
 *   app.use('/api/v1/whatsapp/webhook', express.json({
 *     verify: (req, _res, buf) => { req.rawBody = buf; }
 *   }));
 *
 * @param {import('express').Request} req - Express request (must have req.rawBody)
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing X-Hub-Signature-256 header',
    });
  }

  const appSecret = config.meta.appSecret;
  if (!appSecret) {
    console.error('[whatsapp-service] META_APP_SECRET is not configured');
    return res.status(500).json({
      success: false,
      message: 'Webhook verification not configured',
    });
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error('[whatsapp-service] rawBody not available — ensure express.json verify is configured');
    return res.status(500).json({
      success: false,
      message: 'Webhook body processing error',
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const expectedHeader = `sha256=${expectedSignature}`;

  // Use timing-safe comparison to prevent timing attacks
  let isValid = false;
  try {
    if (signature.length === expectedHeader.length) {
      isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedHeader, 'utf8')
      );
    }
  } catch (err) {
    isValid = false;
  }

  if (!isValid) {
    console.warn('[whatsapp-service] Invalid webhook signature received');
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature',
    });
  }

  next();
}

module.exports = { verifyWebhookSignature };

