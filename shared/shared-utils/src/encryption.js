'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Encrypts a plaintext string using AES-256-CBC.
 *
 * Requires the following environment variables:
 * - ENCRYPTION_KEY: 32-byte hex-encoded key (64 hex characters)
 * - ENCRYPTION_IV: 16-byte hex-encoded initialization vector (32 hex characters)
 *
 * The IV from the environment is used as a base; a random IV is generated per
 * encryption operation for security. The output format is "iv:encryptedData" in hex.
 *
 * @param {string} text - The plaintext to encrypt
 * @returns {string} Encrypted string in "iv:encryptedData" hex format
 * @throws {Error} If ENCRYPTION_KEY or ENCRYPTION_IV are not set or invalid
 */
const encrypt = (text) => {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const encryptionIv = process.env.ENCRYPTION_IV;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (!encryptionIv) {
    throw new Error('ENCRYPTION_IV environment variable is not set');
  }

  const key = Buffer.from(encryptionKey, 'hex');
  const iv = Buffer.from(encryptionIv, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
  }

  if (iv.length !== IV_LENGTH) {
    throw new Error(`ENCRYPTION_IV must be ${IV_LENGTH} bytes (${IV_LENGTH * 2} hex characters)`);
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts an AES-256-CBC encrypted string.
 *
 * Expects the input in "iv:encryptedData" hex format as produced by encrypt().
 *
 * @param {string} encryptedText - The encrypted string in "iv:encryptedData" format
 * @returns {string} The decrypted plaintext
 * @throws {Error} If ENCRYPTION_KEY is not set, or the input format is invalid
 */
const decrypt = (encryptedText) => {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const key = Buffer.from(encryptionKey, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format. Expected "iv:encryptedData"');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = parts[1];

  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV portion must be ${IV_LENGTH} bytes (${IV_LENGTH * 2} hex characters)`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

module.exports = {
  encrypt,
  decrypt,
};
