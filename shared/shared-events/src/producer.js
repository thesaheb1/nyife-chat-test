'use strict';

const { TOPIC_SCHEMAS } = require('./schemas');

/**
 * Publishes a validated event to a Kafka topic.
 *
 * @param {import('kafkajs').Producer} producer - Connected KafkaJS producer instance
 * @param {string} topic - Kafka topic name
 * @param {string} key - Message key (used for partitioning)
 * @param {object} payload - Event payload data
 * @returns {Promise<import('kafkajs').RecordMetadata[]>} Kafka send result
 */
async function publishEvent(producer, topic, key, payload) {
  const schema = TOPIC_SCHEMAS[topic];

  if (schema) {
    const result = schema.safeParse(payload);
    if (!result.success) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`
      );
      throw new Error(
        `Event validation failed for topic "${topic}": ${errors.join(', ')}`
      );
    }
  } else {
    console.warn(
      `[shared-events] No schema found for topic "${topic}" — sending without validation`
    );
  }

  const sendResult = await producer.send({
    topic,
    messages: [
      {
        key: String(key),
        value: JSON.stringify(payload),
        timestamp: Date.now().toString(),
      },
    ],
  });

  return sendResult;
}

module.exports = { publishEvent };
