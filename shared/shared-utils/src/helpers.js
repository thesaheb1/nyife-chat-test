'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const sanitize = require('sanitize-html');

const LOCAL_FRONTEND_FALLBACK_URL = 'https://localhost:5173';
const MONEY_SCALE = 100;
const MONEY_EPSILON = 1e-8;
const LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

/**
 * Generates a new UUID v4 string.
 * @returns {string} A UUID v4 (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
const generateUUID = () => {
  return uuidv4();
};

/**
 * Generates a cryptographically secure random API token.
 * @returns {string} A 64-character hex string (32 random bytes)
 */
const generateApiToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generates a cryptographically secure invitation token.
 *
 * @param {number} sizeInBytes
 * @returns {string}
 */
const generateInvitationToken = (sizeInBytes = 32) => {
  return crypto.randomBytes(sizeInBytes).toString('hex');
};

/**
 * Calculates an invitation expiry date from now.
 *
 * @param {number} ttlDays
 * @param {Date} now
 * @returns {Date}
 */
const calculateInvitationExpiry = (ttlDays = 7, now = new Date()) => {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
};

/**
 * Builds the default organization seed values for a newly-created user.
 *
 * @param {{ userId: string, firstName?: string | null }} params
 * @returns {{ name: string, description: string, slug: string }}
 */
const buildDefaultOrganizationSeed = ({ userId, firstName }) => {
  const normalizedFirstName = String(firstName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || 'User';
  const stableSuffix = String(userId || '').trim().slice(0, 8) || generateUUID().slice(0, 8);
  const name = `${normalizedFirstName}'s Org`;
  const description = `${normalizedFirstName}'s first organization`;
  const slug = slugify(`${name}-${stableSuffix}`);

  return {
    name,
    description,
    slug,
  };
};

/**
 * Converts a string into a URL-friendly slug.
 * - Converts to lowercase
 * - Trims whitespace
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Removes leading and trailing hyphens
 *
 * @param {string} text - The input string to slugify
 * @returns {string} The slugified string
 */
const slugify = (text) => {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '-')     // Replace special chars with hyphens
    .replace(/[\s_]+/g, '-')        // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')            // Remove consecutive hyphens
    .replace(/^-+/, '')             // Remove leading hyphens
    .replace(/-+$/, '');            // Remove trailing hyphens
};

/**
 * Strips all HTML tags from a string, returning only the text content.
 * Uses sanitize-html with an empty allowedTags list to strip everything.
 *
 * @param {string} dirty - The potentially unsafe HTML string
 * @returns {string} Sanitized plain text string with all tags stripped
 */
const sanitizeHtml = (dirty) => {
  return sanitize(dirty, {
    allowedTags: [],
    allowedAttributes: {},
  });
};

/**
 * Formats a monetary amount stored as paise (smallest currency unit) into
 * a human-readable currency string.
 *
 * @param {number} amountInPaise - The amount in the smallest currency unit (e.g., paise for INR, cents for USD)
 * @param {string} currency - ISO 4217 currency code (default: 'INR')
 * @returns {string} Formatted currency string (e.g., "₹100.00", "$50.25")
 */
const formatCurrency = (amountInPaise, currency = 'INR') => {
  const amount = (Number(amountInPaise) / MONEY_SCALE).toFixed(2);

  const currencySymbols = {
    INR: '\u20B9',
    USD: '$',
    EUR: '\u20AC',
    GBP: '\u00A3',
  };

  const symbol = currencySymbols[currency.toUpperCase()] || currency;

  return `${symbol}${amount}`;
};

function isValidRupeeAmount(amount, { allowZero = true } = {}) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return false;
  }

  if (allowZero ? numericAmount < 0 : numericAmount <= 0) {
    return false;
  }

  const scaledAmount = numericAmount * MONEY_SCALE;
  return Math.abs(scaledAmount - Math.round(scaledAmount)) < MONEY_EPSILON;
}

function rupeesToPaise(amount, { allowZero = true } = {}) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    throw new TypeError('Amount must be a finite number');
  }

  if (allowZero ? numericAmount < 0 : numericAmount <= 0) {
    throw new RangeError(
      allowZero ? 'Amount must be zero or greater' : 'Amount must be greater than zero'
    );
  }

  const scaledAmount = numericAmount * MONEY_SCALE;
  const roundedAmount = Math.round(scaledAmount);

  if (Math.abs(scaledAmount - roundedAmount) >= MONEY_EPSILON) {
    throw new RangeError('Amount can have at most 2 decimal places');
  }

  return roundedAmount;
}

function paiseToRupees(amountInPaise) {
  const numericAmount = Number(amountInPaise);
  if (!Number.isFinite(numericAmount)) {
    return 0;
  }

  return numericAmount / MONEY_SCALE;
}

function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.has(String(hostname || '').toLowerCase());
}

function normalizeUrl(value) {
  return String(value).replace(/\/+$/, '');
}

function normalizeFrontendUrlCandidate(value, { upgradeLocalHttp = false } = {}) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    const isLocalViteUrl = isLoopbackHost(parsed.hostname) && (!parsed.port || parsed.port === '5173');
    if ((upgradeLocalHttp || isLocalViteUrl) && parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) {
      parsed.protocol = 'https:';
    }

    return normalizeUrl(parsed.toString());
  } catch {
    return null;
  }
}

function resolveFrontendAppUrl(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isDevelopment = nodeEnv === 'development';
  const publicCandidates = [
    env.PUBLIC_FRONTEND_URL,
    env.FRONTEND_PUBLIC_URL,
  ].filter(Boolean);
  const appCandidates = [
    env.FRONTEND_APP_URL,
    env.FRONTEND_URL,
    env.APP_URL,
  ].filter(Boolean);
  const orderedCandidates = isDevelopment
    ? [...appCandidates, ...publicCandidates]
    : [...publicCandidates, ...appCandidates];

  for (const candidate of orderedCandidates) {
    const normalized = normalizeFrontendUrlCandidate(candidate, {
      upgradeLocalHttp: isDevelopment,
    });

    if (normalized) {
      return normalized;
    }
  }

  return LOCAL_FRONTEND_FALLBACK_URL;
}

module.exports = {
  generateUUID,
  generateApiToken,
  generateInvitationToken,
  calculateInvitationExpiry,
  buildDefaultOrganizationSeed,
  slugify,
  sanitizeHtml,
  formatCurrency,
  isValidRupeeAmount,
  rupeesToPaise,
  paiseToRupees,
  resolveFrontendAppUrl,
};
