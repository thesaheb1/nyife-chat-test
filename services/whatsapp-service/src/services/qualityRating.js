'use strict';

const FALLBACK_QUALITY_RATING = 'UNKNOWN';
const KNOWN_QUALITY_RATINGS = new Set(['GREEN', 'YELLOW', 'RED', FALLBACK_QUALITY_RATING]);

function normalizeQualityRating(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (KNOWN_QUALITY_RATINGS.has(normalized)) {
    return normalized;
  }

  console.warn(
    `[whatsapp-service] Unexpected Meta quality rating "${normalized}" received. Storing ${FALLBACK_QUALITY_RATING} instead.`
  );
  return FALLBACK_QUALITY_RATING;
}

module.exports = {
  FALLBACK_QUALITY_RATING,
  normalizeQualityRating,
};
