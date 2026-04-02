'use strict';

require('dotenv').config();

const { Kafka, logLevel } = require('kafkajs');

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function retryKafkaStartup(factory, label, options = {}) {
  const maxAttempts = parsePositiveInt(
    options.maxAttempts || process.env.KAFKA_STARTUP_MAX_ATTEMPTS,
    30
  );
  const initialDelayMs = parsePositiveInt(
    options.initialDelayMs || process.env.KAFKA_STARTUP_INITIAL_DELAY_MS,
    1000
  );
  const maxDelayMs = parsePositiveInt(
    options.maxDelayMs || process.env.KAFKA_STARTUP_MAX_DELAY_MS,
    15000
  );

  let attempt = 0;
  let delayMs = initialDelayMs;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await factory();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const jitterMs = Math.floor(Math.random() * Math.min(1000, Math.max(250, delayMs / 3)));
      const waitMs = Math.min(delayMs + jitterMs, maxDelayMs);

      console.warn(
        `[Kafka][${label}] Startup attempt ${attempt} failed: ${error.message}. Retrying in ${waitMs}ms`
      );

      await sleep(waitMs);
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }

  throw new Error(`[Kafka][${label}] Kafka startup retries exhausted`);
}

/**
 * Parses the KAFKA_BROKERS environment variable into an array of broker addresses.
 *
 * @returns {string[]} Array of Kafka broker addresses.
 */
function parseBrokers() {
  const brokersEnv = process.env.KAFKA_BROKERS || 'localhost:9092';
  return brokersEnv.split(',').map((broker) => broker.trim()).filter(Boolean);
}

/**
 * Creates a configured KafkaJS client instance.
 *
 * @param {string} clientId - A unique identifier for this Kafka client.
 * @returns {Kafka} A configured KafkaJS client.
 */
function createKafkaClient(clientId) {
  if (!clientId || typeof clientId !== 'string') {
    throw new Error('clientId is required and must be a non-empty string');
  }

  const brokers = parseBrokers();

  const kafka = new Kafka({
    clientId,
    brokers,
    connectionTimeout: 10000,
    requestTimeout: 30000,
    logLevel: isProduction ? logLevel.WARN : logLevel.INFO,
    retry: {
      initialRetryTime: 300,
      retries: 10,
      maxRetryTime: 30000,
      factor: 2,
      multiplier: 1.5,
    },
  });

  return kafka;
}

/**
 * Creates and connects a Kafka producer.
 *
 * @param {string} clientId - A unique identifier for this Kafka client.
 * @returns {Promise<import('kafkajs').Producer>} A connected Kafka producer.
 */
async function createKafkaProducer(clientId) {
  const kafka = createKafkaClient(clientId);

  const producer = kafka.producer({
    allowAutoTopicCreation: false,
    transactionTimeout: 30000,
    idempotent: true,
    maxInFlightRequests: 5,
  });

  producer.on('producer.connect', () => {
    console.log(`[Kafka][${clientId}] Producer connected.`);
  });

  producer.on('producer.disconnect', () => {
    console.log(`[Kafka][${clientId}] Producer disconnected.`);
  });

  producer.on('producer.network.request_timeout', (payload) => {
    console.error(`[Kafka][${clientId}] Producer request timeout:`, payload);
  });

  try {
    await producer.connect();
    console.log(`[Kafka][${clientId}] Producer ready.`);
  } catch (error) {
    console.error(`[Kafka][${clientId}] Failed to connect producer:`, error.message);
    throw error;
  }

  return producer;
}

async function createKafkaProducerWithRetry(clientId, options = {}) {
  return retryKafkaStartup(
    () => createKafkaProducer(clientId),
    `${clientId}:producer`,
    options
  );
}

/**
 * Creates and connects a Kafka consumer with the given group ID.
 *
 * @param {string} clientId - A unique identifier for this Kafka client.
 * @param {string} groupId - The consumer group ID.
 * @returns {Promise<import('kafkajs').Consumer>} A connected Kafka consumer.
 */
async function createKafkaConsumer(clientId, groupId) {
  if (!groupId || typeof groupId !== 'string') {
    throw new Error('groupId is required and must be a non-empty string');
  }

  const kafka = createKafkaClient(clientId);

  const consumer = kafka.consumer({
    groupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxBytesPerPartition: 1048576,
    retry: {
      retries: 10,
      initialRetryTime: 300,
    },
  });

  consumer.on('consumer.connect', () => {
    console.log(`[Kafka][${clientId}] Consumer (group: ${groupId}) connected.`);
  });

  consumer.on('consumer.disconnect', () => {
    console.log(`[Kafka][${clientId}] Consumer (group: ${groupId}) disconnected.`);
  });

  consumer.on('consumer.crash', (event) => {
    console.error(`[Kafka][${clientId}] Consumer (group: ${groupId}) crashed:`, event.payload.error);
  });

  consumer.on('consumer.group_join', (event) => {
    console.log(`[Kafka][${clientId}] Consumer joined group ${event.payload.groupId} (member: ${event.payload.memberId}).`);
  });

  consumer.on('consumer.stop', () => {
    console.log(`[Kafka][${clientId}] Consumer (group: ${groupId}) stopped.`);
  });

  try {
    await consumer.connect();
    console.log(`[Kafka][${clientId}] Consumer (group: ${groupId}) ready.`);
  } catch (error) {
    console.error(`[Kafka][${clientId}] Failed to connect consumer (group: ${groupId}):`, error.message);
    throw error;
  }

  return consumer;
}

async function createKafkaConsumerWithRetry(clientId, groupId, options = {}) {
  return retryKafkaStartup(
    () => createKafkaConsumer(clientId, groupId),
    `${clientId}:consumer:${groupId}`,
    options
  );
}

module.exports = {
  createKafkaClient,
  createKafkaProducer,
  createKafkaProducerWithRetry,
  createKafkaConsumer,
  createKafkaConsumerWithRetry,
  __private: {
    retryKafkaStartup,
  },
};
