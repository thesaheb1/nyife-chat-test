'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  recordWebhookObservation,
  getWebhookAlignmentDiagnostics,
  __private: { buildRedisKey },
} = require('../src/helpers/webhookDiagnostics');

function createRedisStub() {
  const store = new Map();

  return {
    async set(key, value) {
      store.set(key, value);
    },
    async get(key) {
      return store.get(key) || null;
    },
  };
}

test('buildRedisKey uses the namespace-local key without duplicating the redis client prefix', () => {
  assert.equal(buildRedisKey('latest'), 'webhook-diagnostics:latest:latest');
  assert.equal(buildRedisKey('phone-number', '1030467583479012'), 'webhook-diagnostics:phone-number:1030467583479012');
});

test('recordWebhookObservation stores diagnostics that account health can read back by phone and waba', async () => {
  const redis = createRedisStub();

  await recordWebhookObservation(redis, {
    envelope_format: 'meta',
    field: 'messages',
    waba_id: '1468289684238203',
    phone_number_id: '1030467583479012',
    meta_message_id: 'wamid-1',
    local_wa_account_id: 'wa-1',
    matched_wa_message_id: 'msg-1',
    matched_campaign_id: 'campaign-1',
    status: 'read',
  });

  const diagnostics = await getWebhookAlignmentDiagnostics(redis, {
    waba_id: '1468289684238203',
    phone_number_id: '1030467583479012',
  });

  assert.equal(diagnostics.latest.phone_number_id, '1030467583479012');
  assert.equal(diagnostics.by_phone_number_id.phone_number_id, '1030467583479012');
  assert.equal(diagnostics.by_waba_id.waba_id, '1468289684238203');
  assert.equal(diagnostics.exact_phone_number_match, true);
  assert.equal(diagnostics.exact_waba_match, true);
  assert.equal(diagnostics.account_match_confirmed, true);
});
