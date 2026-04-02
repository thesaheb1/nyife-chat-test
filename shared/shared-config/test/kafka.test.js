'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  __private: { retryKafkaStartup },
} = require('../src/kafka');

test('retryKafkaStartup retries until the factory succeeds', async () => {
  let attempts = 0;

  const result = await retryKafkaStartup(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error(`connect failed ${attempts}`);
      }
      return 'connected';
    },
    'test-kafka',
    {
      maxAttempts: 5,
      initialDelayMs: 1,
      maxDelayMs: 2,
    }
  );

  assert.equal(result, 'connected');
  assert.equal(attempts, 3);
});

test('retryKafkaStartup throws after the configured max attempts', async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      retryKafkaStartup(
        async () => {
          attempts += 1;
          throw new Error('still unavailable');
        },
        'test-kafka',
        {
          maxAttempts: 3,
          initialDelayMs: 1,
          maxDelayMs: 2,
        }
      ),
    /still unavailable/
  );

  assert.equal(attempts, 3);
});
