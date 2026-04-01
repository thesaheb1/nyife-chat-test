'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('node:assert/strict');
const test = require('node:test');

const { normalizeWebhookEnvelope } = require('../src/helpers/webhookEnvelope');

test('normalizeWebhookEnvelope keeps native Meta webhook envelopes unchanged', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: '123' },
              statuses: [{ id: 'wamid-1', status: 'sent' }],
            },
          },
        ],
      },
    ],
  };

  const normalized = normalizeWebhookEnvelope(payload);

  assert.equal(normalized.format, 'meta');
  assert.equal(normalized.envelope, payload);
});

test('normalizeWebhookEnvelope wraps legacy forwarded webhook events into a Meta-like envelope', () => {
  const payload = {
    event: 'message.received',
    data: {
      field: 'messages',
      value: {
        metadata: {
          display_phone_number: '15558077904',
          phone_number_id: '1030467583479012',
        },
        contacts: [{ wa_id: '+918800281734', profile: { name: 'Test User' } }],
        messages: [
          {
            from: '+918800281734',
            id: 'wamid-123',
            timestamp: '1727857481',
            type: 'text',
            text: { body: 'Hi' },
          },
        ],
      },
      waba_id: 'waba-legacy-1',
    },
  };

  const normalized = normalizeWebhookEnvelope(payload);

  assert.equal(normalized.format, 'legacy_forwarded');
  assert.equal(normalized.eventName, 'message.received');
  assert.equal(normalized.envelope.object, 'whatsapp_business_account');
  assert.equal(normalized.envelope.entry[0].id, 'waba-legacy-1');
  assert.equal(normalized.envelope.entry[0].changes[0].field, 'messages');
  assert.deepEqual(
    normalized.envelope.entry[0].changes[0].value.messages[0],
    payload.data.value.messages[0]
  );
});

test('normalizeWebhookEnvelope maps legacy accepted message.sent payloads to queued statuses', () => {
  const payload = {
    event: 'message.sent',
    data: {
      data: {
        success: true,
        data: {
          contacts: [{ input: '+918800281734', wa_id: '+918800281734' }],
          messages: [
            {
              id: 'wamid-accepted-1',
              message_status: 'accepted',
            },
          ],
        },
      },
    },
  };

  const normalized = normalizeWebhookEnvelope(payload);
  const value = normalized.envelope.entry[0].changes[0].value;

  assert.equal(normalized.format, 'legacy_forwarded');
  assert.equal(value.messages, undefined);
  assert.deepEqual(value.statuses, [
    {
      id: 'wamid-accepted-1',
      status: 'queued',
      recipient_id: '+918800281734',
      timestamp: null,
    },
  ]);
});
