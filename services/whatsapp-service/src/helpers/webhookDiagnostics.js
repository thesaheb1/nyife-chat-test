'use strict';

const WEBHOOK_DIAGNOSTIC_TTL_SECONDS = 60 * 60 * 24 * 14;

function buildRedisKey(kind, value = 'latest') {
  return `whatsapp:webhook-diagnostics:${kind}:${value}`;
}

function normalizeObservation(observation = {}) {
  return {
    received_at: observation.received_at || new Date().toISOString(),
    envelope_format: observation.envelope_format || null,
    event_name: observation.event_name || null,
    field: observation.field || null,
    waba_id: observation.waba_id ? String(observation.waba_id) : null,
    phone_number_id: observation.phone_number_id ? String(observation.phone_number_id) : null,
    local_wa_account_id: observation.local_wa_account_id || null,
    local_wa_account_user_id: observation.local_wa_account_user_id || null,
    matched_wa_message_id: observation.matched_wa_message_id || null,
    matched_campaign_id: observation.matched_campaign_id || null,
    matched_campaign_message_id: observation.matched_campaign_message_id || null,
    status: observation.status || null,
    meta_message_id: observation.meta_message_id || null,
    direction: observation.direction || null,
    notes: Array.isArray(observation.notes) ? observation.notes : [],
  };
}

async function setJson(redis, key, value) {
  await redis.set(key, JSON.stringify(value), 'EX', WEBHOOK_DIAGNOSTIC_TTL_SECONDS);
}

async function getJson(redis, key) {
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function recordWebhookObservation(redis, observation) {
  if (!redis) {
    return;
  }

  const normalized = normalizeObservation(observation);
  const writes = [
    setJson(redis, buildRedisKey('latest'), normalized),
  ];

  if (normalized.phone_number_id) {
    writes.push(setJson(redis, buildRedisKey('phone-number', normalized.phone_number_id), normalized));
  }

  if (normalized.waba_id) {
    writes.push(setJson(redis, buildRedisKey('waba', normalized.waba_id), normalized));
  }

  await Promise.allSettled(writes);
}

function buildAlignment(expectedValue, observedValue) {
  if (!observedValue) {
    return null;
  }

  return String(expectedValue || '') === String(observedValue || '');
}

async function getWebhookAlignmentDiagnostics(redis, account) {
  if (!redis || !account) {
    return {
      latest: null,
      by_phone_number_id: null,
      by_waba_id: null,
      exact_phone_number_match: null,
      exact_waba_match: null,
      account_match_confirmed: null,
    };
  }

  const [latest, byPhoneNumberId, byWabaId] = await Promise.all([
    getJson(redis, buildRedisKey('latest')),
    account.phone_number_id ? getJson(redis, buildRedisKey('phone-number', String(account.phone_number_id))) : Promise.resolve(null),
    account.waba_id ? getJson(redis, buildRedisKey('waba', String(account.waba_id))) : Promise.resolve(null),
  ]);

  const exactPhoneNumberMatch = buildAlignment(account.phone_number_id, latest?.phone_number_id);
  const exactWabaMatch = buildAlignment(account.waba_id, latest?.waba_id);
  const accountMatchConfirmed = exactPhoneNumberMatch === true && exactWabaMatch === true;

  return {
    latest,
    by_phone_number_id: byPhoneNumberId,
    by_waba_id: byWabaId,
    exact_phone_number_match: exactPhoneNumberMatch,
    exact_waba_match: exactWabaMatch,
    account_match_confirmed: accountMatchConfirmed,
  };
}

module.exports = {
  recordWebhookObservation,
  getWebhookAlignmentDiagnostics,
};
