'use strict';

const crypto = require('crypto');
const config = require('../config');
const { normalizeWebhookEnvelope } = require('../helpers/webhookEnvelope');

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(left, 'utf8'),
      Buffer.from(right, 'utf8')
    );
  } catch {
    return false;
  }
}

function buildSha256Signature(secret, rawBody) {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

function isValidMetaSignature(signature, rawBody, appSecret) {
  if (!signature || !rawBody || !appSecret) {
    return false;
  }

  return constantTimeEqual(signature, buildSha256Signature(appSecret, rawBody));
}

function isValidForwardedSignature(signature, rawBody, bridgeSecret) {
  if (!signature || !rawBody || !bridgeSecret) {
    return false;
  }

  return constantTimeEqual(signature, buildSha256Signature(bridgeSecret, rawBody));
}

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
  const forwardedSignature = req.headers['x-nyife-webhook-signature-256'];
  const forwardedToken = req.headers['x-nyife-webhook-token'];
  const normalizedEnvelope = normalizeWebhookEnvelope(req.body);
  const isLegacyForwarded = normalizedEnvelope?.format === 'legacy_forwarded';
  req.webhookEnvelopeFormat = normalizedEnvelope?.format || null;

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error('[whatsapp-service] rawBody not available — ensure express.json verify is configured');
    return res.status(500).json({
      success: false,
      message: 'Webhook body processing error',
    });
  }

  const appSecret = config.meta.appSecret;
  if (signature) {
    if (!appSecret) {
      console.error('[whatsapp-service] META_APP_SECRET is not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook verification not configured',
      });
    }

    if (isValidMetaSignature(signature, rawBody, appSecret)) {
      req.webhookAuth = { strategy: 'meta_signature' };
      return next();
    }

    if (!isLegacyForwarded) {
      console.warn('[whatsapp-service] Invalid Meta webhook signature received');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }
  }

  if (!isLegacyForwarded) {
    return res.status(401).json({
      success: false,
      message: 'Missing X-Hub-Signature-256 header',
    });
  }

  const bridgeSecret = config.meta.forwardedWebhookSecret;
  if (forwardedSignature) {
    if (!bridgeSecret) {
      console.error('[whatsapp-service] META_WEBHOOK_FORWARD_SECRET is not configured');
      return res.status(500).json({
        success: false,
        message: 'Legacy webhook bridge verification is not configured',
      });
    }

    if (!isValidForwardedSignature(forwardedSignature, rawBody, bridgeSecret)) {
      console.warn('[whatsapp-service] Invalid forwarded webhook signature received');
      return res.status(401).json({
        success: false,
        message: 'Invalid forwarded webhook signature',
      });
    }

    req.webhookAuth = { strategy: 'legacy_bridge_signature' };
    return next();
  }

  if (forwardedToken) {
    if (!bridgeSecret) {
      console.error('[whatsapp-service] META_WEBHOOK_FORWARD_SECRET is not configured');
      return res.status(500).json({
        success: false,
        message: 'Legacy webhook bridge verification is not configured',
      });
    }

    if (!constantTimeEqual(String(forwardedToken), String(bridgeSecret))) {
      console.warn('[whatsapp-service] Invalid forwarded webhook token received');
      return res.status(401).json({
        success: false,
        message: 'Invalid forwarded webhook token',
      });
    }

    req.webhookAuth = { strategy: 'legacy_bridge_token' };
    return next();
  }

  if (config.nodeEnv !== 'production' && config.meta.allowUnsignedForwardedWebhooks) {
    console.warn('[whatsapp-service] Allowing unsigned legacy forwarded webhook in non-production mode');
    req.webhookAuth = { strategy: 'legacy_unsigned_dev' };
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Missing legacy webhook bridge signature',
  });
}

module.exports = { verifyWebhookSignature };
