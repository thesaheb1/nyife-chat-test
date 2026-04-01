'use strict';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  META_ALLOW_UNSIGNED_FORWARDED_WEBHOOKS: process.env.META_ALLOW_UNSIGNED_FORWARDED_WEBHOOKS,
  META_WEBHOOK_FORWARD_SECRET: process.env.META_WEBHOOK_FORWARD_SECRET,
  META_APP_SECRET: process.env.META_APP_SECRET,
};

function loadMiddleware() {
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/middlewares/webhookSignature')];
  return require('../src/middlewares/webhookSignature');
}

function createResponseCapture() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  process.env.META_ALLOW_UNSIGNED_FORWARDED_WEBHOOKS = originalEnv.META_ALLOW_UNSIGNED_FORWARDED_WEBHOOKS;
  process.env.META_WEBHOOK_FORWARD_SECRET = originalEnv.META_WEBHOOK_FORWARD_SECRET;
  process.env.META_APP_SECRET = originalEnv.META_APP_SECRET;
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/middlewares/webhookSignature')];
});

test('verifyWebhookSignature accepts unsigned legacy forwarded webhooks in non-production when explicitly enabled', () => {
  process.env.NODE_ENV = 'development';
  process.env.META_ALLOW_UNSIGNED_FORWARDED_WEBHOOKS = 'true';

  const { verifyWebhookSignature } = loadMiddleware();
  const body = {
    event: 'message.received',
    data: {
      field: 'messages',
      value: {
        metadata: { phone_number_id: '1030467583479012' },
        messages: [],
      },
    },
  };
  const req = {
    headers: {},
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
  };
  const res = createResponseCapture();
  let nextCalled = false;

  verifyWebhookSignature(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.webhookAuth.strategy, 'legacy_unsigned_dev');
  assert.equal(res.statusCode, null);
});

test('verifyWebhookSignature rejects native Meta webhook payloads that do not include the Meta signature header', () => {
  process.env.NODE_ENV = 'development';
  process.env.META_ALLOW_UNSIGNED_FORWARDED_WEBHOOKS = 'true';
  process.env.META_APP_SECRET = 'test-secret';

  const { verifyWebhookSignature } = loadMiddleware();
  const body = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: '1030467583479012' },
              messages: [],
            },
          },
        ],
      },
    ],
  };
  const req = {
    headers: {},
    body,
    rawBody: Buffer.from(JSON.stringify(body)),
  };
  const res = createResponseCapture();

  verifyWebhookSignature(req, res, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.message, 'Missing X-Hub-Signature-256 header');
});
