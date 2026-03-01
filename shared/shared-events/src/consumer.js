'use strict';

const { TOPIC_SCHEMAS } = require('./schemas');

/**
 * Creates and starts a Kafka event consumer for a specific topic.
 *
 * @param {import('kafkajs').Consumer} consumer - KafkaJS consumer instance (not yet subscribed)
 * @param {string} topic - Kafka topic to subscribe to
 * @param {Function} handler - Async handler function: (payload, metadata) => Promise<void>
 *   metadata: { topic, partition, offset, key, timestamp }
 * @returns {Promise<void>}
 */
async function createEventConsumer(consumer, topic, handler) {
  await consumer.subscribe({ topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic: msgTopic, partition, message }) => {
      const metadata = {
        topic: msgTopic,
        partition,
        offset: message.offset,
        key: message.key ? message.key.toString() : null,
        timestamp: message.timestamp,
      };

      let payload;
      try {
        payload = JSON.parse(message.value.toString());
      } catch (parseError) {
        console.error(
          `[shared-events] Failed to parse message from topic "${msgTopic}" ` +
            `partition=${partition} offset=${message.offset}:`,
          parseError.message
        );
        return;
      }

      const schema = TOPIC_SCHEMAS[msgTopic];
      if (schema) {
        const result = schema.safeParse(payload);
        if (!result.success) {
          console.warn(
            `[shared-events] Message validation warning for topic "${msgTopic}" ` +
              `offset=${message.offset}:`,
            result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
          );
        }
      }

      try {
        await handler(payload, metadata);
      } catch (handlerError) {
        console.error(
          `[shared-events] Handler error for topic "${msgTopic}" ` +
            `partition=${partition} offset=${message.offset}:`,
          handlerError
        );
      }
    },
  });
}

module.exports = { createEventConsumer };
