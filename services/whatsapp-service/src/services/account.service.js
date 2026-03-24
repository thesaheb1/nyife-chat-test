'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { publishEvent, TOPICS } = require('@nyife/shared-events');
const { WaAccount, WaOnboardingAttempt } = require('../models');
const {
  AppError,
  encrypt,
  META_CREDENTIAL_SOURCES,
} = require('@nyife/shared-utils');
const config = require('../config');
const {
  requireResolvedMetaCredential,
  hasProviderManagementConfig,
} = require('./metaAccess.service');
const { normalizeQualityRating } = require('./qualityRating');

const SIGNUP_SESSION_TTL_SECONDS = 10 * 60;
const signupSessionFallbackStore = new Map();
const ONBOARDING_STEP_SKIPPED = 'skipped';
const ONBOARDING_STEP_COMPLETED = 'completed';
const ONBOARDING_STEP_FAILED = 'failed';
const LEGACY_EMBEDDED_SIGNUP_PIN = '123456';
const REGISTER_ENDPOINT_GRAPH_API_VERSION = 'v20.0';

function createStep(name, status, message, extra = {}) {
  return {
    name,
    status,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function buildProviderReadiness(redisAvailable) {
  const configured = hasProviderManagementConfig();
  const partialProviderConfig = Boolean(
    config.meta.systemUserAccessToken
    || config.meta.systemUserId
    || config.meta.providerBusinessId
    || config.meta.overrideCallbackUrl
    || config.meta.creditLineId
    || config.meta.enableCreditSharing
  );
  const warnings = [];

  if (partialProviderConfig && !configured) {
    warnings.push(
      'Some optional provider-mode Meta credentials are incomplete. Nyife will continue in the standard Embedded Signup mode.'
    );
  }

  if (!redisAvailable && config.redis.requiredForSignup) {
    warnings.push('Redis is required for Embedded Signup sessions in this environment.');
  }

  if (config.meta.enableCreditSharing && !config.meta.creditLineId) {
    warnings.push(
      'Credit sharing is enabled, but META_CREDIT_LINE_ID is not configured. The credit attachment step will be skipped.'
    );
  }

  return {
    provider_configured: configured,
    system_user_id: config.meta.systemUserId || null,
    provider_business_id: config.meta.providerBusinessId || null,
    legacy_token_fallback_enabled: Boolean(config.meta.allowLegacyAccountTokenFallback),
    redis_backed_session: Boolean(redisAvailable),
    credit_sharing_enabled: Boolean(config.meta.enableCreditSharing),
    override_callback_url_configured: Boolean(config.meta.overrideCallbackUrl),
    warnings,
  };
}

function ensureSignupSessionStoreAvailable(redis) {
  if (redis || !config.redis.requiredForSignup) {
    return;
  }

  throw new AppError(
    'Redis is required for Embedded Signup sessions in this environment. Restore Redis and retry the Meta connection flow.',
    503
  );
}

function getMetaErrorMessage(err, fallbackMessage) {
  const metaMessage = err.response?.data?.error?.message;
  return metaMessage || fallbackMessage || err.message;
}

function getMetaErrorCode(err) {
  return String(err.response?.data?.error?.code || '');
}

function isPhoneConnectedStatus(status) {
  return String(status || '').trim().toUpperCase() === 'CONNECTED';
}

function deriveDataLocalizationRegion(displayPhone) {
  if (!displayPhone) {
    return null;
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(displayPhone);
    return phoneNumber?.country || null;
  } catch (err) {
    console.warn(
      `[whatsapp-service] Failed to derive data localization region for phone "${displayPhone}":`,
      err.message
    );
    return null;
  }
}

function buildRegisterPhonePayload(displayPhone) {
  const payload = {
    messaging_product: 'whatsapp',
    pin: LEGACY_EMBEDDED_SIGNUP_PIN,
  };
  const dataLocalizationRegion = deriveDataLocalizationRegion(displayPhone);

  if (dataLocalizationRegion) {
    payload.data_localization_region = dataLocalizationRegion;
  }

  return payload;
}

function getLegacyPinRepairMessage(phoneNumberId) {
  return `Meta reported a two-step verification PIN mismatch for phone number ${phoneNumberId}. Use the "Repair legacy signup compatibility" action in Nyife to reset the shared legacy PIN before trying again.`;
}

function buildMetaHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function resolveRegistrationPin() {
  return LEGACY_EMBEDDED_SIGNUP_PIN;
}

function sanitizeConnectedAccount(account) {
  return account ? account.toSafeJSON() : null;
}

function serializeDiscoveredPhone(phone, existingAccount, organizationWabaId = null) {
  const alreadyConnected = Boolean(
    existingAccount
    && !existingAccount.deleted_at
    && existingAccount.status === 'active'
  );
  const wabaMismatch = Boolean(
    organizationWabaId
    && String(phone.waba_id) !== String(organizationWabaId)
  );
  const eligibilityReason = alreadyConnected
    ? 'already_connected'
    : wabaMismatch
      ? 'organization_waba_locked'
      : null;

  return {
    waba_id: String(phone.waba_id),
    phone_number_id: String(phone.phone_number_id),
    display_phone: phone.display_phone || null,
    verified_name: phone.verified_name || null,
    quality_rating: normalizeQualityRating(phone.quality_rating),
    already_connected: alreadyConnected,
    eligible: !alreadyConnected && !wabaMismatch,
    eligibility_reason: eligibilityReason,
    existing_account_id: existingAccount?.id || null,
    onboarding_status: existingAccount?.onboarding_status || null,
    credential_source: existingAccount?.credential_source || null,
  };
}

function summarizeWabas(discoveredPhones) {
  const summary = new Map();

  for (const phone of discoveredPhones || []) {
    const key = String(phone.waba_id);
    const current = summary.get(key) || {
      waba_id: key,
      name: phone.waba_name || phone.verified_name || null,
      phone_count: 0,
    };
    current.phone_count += 1;
    summary.set(key, current);
  }

  return Array.from(summary.values());
}

function getSignupSessionKey(signupSessionId) {
  return `signup-session:${signupSessionId}`;
}

function pruneExpiredFallbackSessions() {
  const now = Date.now();
  for (const [sessionId, record] of signupSessionFallbackStore.entries()) {
    if (!record || record.expiresAt <= now) {
      signupSessionFallbackStore.delete(sessionId);
    }
  }
}

async function saveSignupSession(redis, payload) {
  ensureSignupSessionStoreAvailable(redis);
  const signupSessionId = crypto.randomUUID();
  const key = getSignupSessionKey(signupSessionId);
  const serialized = JSON.stringify({
    ...payload,
    createdAt: new Date().toISOString(),
  });

  if (redis) {
    await redis.set(key, serialized, 'EX', SIGNUP_SESSION_TTL_SECONDS);
    return signupSessionId;
  }

  pruneExpiredFallbackSessions();
  signupSessionFallbackStore.set(signupSessionId, {
    value: serialized,
    expiresAt: Date.now() + (SIGNUP_SESSION_TTL_SECONDS * 1000),
  });
  return signupSessionId;
}

async function loadSignupSession(redis, signupSessionId) {
  ensureSignupSessionStoreAvailable(redis);
  const key = getSignupSessionKey(signupSessionId);

  if (redis) {
    const raw = await redis.get(key);
    if (!raw) {
      throw AppError.badRequest('Embedded signup session expired. Restart the Meta connection flow.');
    }
    return JSON.parse(raw);
  }

  pruneExpiredFallbackSessions();
  const fallbackRecord = signupSessionFallbackStore.get(signupSessionId);
  if (!fallbackRecord) {
    throw AppError.badRequest('Embedded signup session expired. Restart the Meta connection flow.');
  }

  return JSON.parse(fallbackRecord.value);
}

async function deleteSignupSession(redis, signupSessionId) {
  ensureSignupSessionStoreAvailable(redis);
  const key = getSignupSessionKey(signupSessionId);

  if (redis) {
    await redis.del(key);
    return;
  }

  signupSessionFallbackStore.delete(signupSessionId);
}

async function fetchWhatsAppNumberLimit(userId) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/check-limit/${userId}/whatsapp_numbers`,
      { timeout: 5000 }
    );

    return response.data?.data || null;
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    }

    console.warn('[whatsapp-service] Could not check subscription limit:', err.message);
    return null;
  }
}

async function getActiveAccountCount(userId) {
  return WaAccount.count({
    where: {
      user_id: userId,
      status: 'active',
    },
  });
}

async function getConnectedOrganizationWabas(userId) {
  const records = await WaAccount.findAll({
    attributes: ['waba_id'],
    where: {
      user_id: userId,
      status: 'active',
    },
    group: ['waba_id'],
  });

  return records
    .map((record) => String(record.waba_id || ''))
    .filter(Boolean);
}

async function getRemainingWhatsAppSlots(userId) {
  const [limitData, activeCount] = await Promise.all([
    fetchWhatsAppNumberLimit(userId),
    getActiveAccountCount(userId),
  ]);

  if (!limitData) {
    return {
      activeCount,
      remainingSlots: null,
      limit: null,
      hasActiveSubscription: true,
    };
  }

  if (limitData.message === 'No active subscription') {
    return {
      activeCount,
      remainingSlots: 0,
      limit: 0,
      hasActiveSubscription: false,
    };
  }

  if (limitData.limit === 'unlimited') {
    return {
      activeCount,
      remainingSlots: null,
      limit: null,
      hasActiveSubscription: true,
    };
  }

  const numericLimit = Number(limitData.limit || 0);

  return {
    activeCount,
    remainingSlots: Math.max(0, numericLimit - activeCount),
    limit: numericLimit,
    hasActiveSubscription: true,
  };
}

async function adjustWhatsAppNumberUsage(userId, count) {
  if (!count) {
    return;
  }

  try {
    await axios.post(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${userId}`,
      {
        resource: 'whatsapp_numbers',
        count,
      },
      {
        timeout: 5000,
      }
    );
  } catch (err) {
    console.warn('[whatsapp-service] Could not update WhatsApp number usage:', err.message);
  }
}

async function exchangeCodeForAccessToken(code) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${config.meta.apiVersion}/oauth/access_token`,
      {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          code,
        },
      }
    );

    const accessToken = response.data?.access_token;
    if (!accessToken) {
      throw new Error('No access token returned from Meta OAuth');
    }

    return accessToken;
  } catch (err) {
    throw AppError.badRequest(
      `Failed to exchange authorization code with Meta. ${getMetaErrorMessage(err, 'Meta OAuth exchange failed.')}`
    );
  }
}

async function debugAccessToken(accessToken) {
  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/debug_token`,
      {
        params: {
          input_token: accessToken,
          access_token: `${config.meta.appId}|${config.meta.appSecret}`,
        },
      }
    );

    return response.data?.data || null;
  } catch (err) {
    throw AppError.badRequest(
      `Failed to inspect Meta access token. ${getMetaErrorMessage(err, 'Debug token call failed.')}`
    );
  }
}

function extractBusinessId(debugData) {
  return debugData?.granular_scopes
    ?.find((scope) => scope.scope === 'whatsapp_business_management')
    ?.target_ids?.[0]
    || debugData?.profile_id
    || null;
}

async function fetchWabaListFromBusinessEdge(accessToken, businessId, edge) {
  if (!businessId) {
    return [];
  }

  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/${businessId}/${edge}`,
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 15000,
      }
    );

    return Array.isArray(response.data?.data) ? response.data.data : [];
  } catch (err) {
    console.warn(
      `[whatsapp-service] Failed to fetch ${edge} for business ${businessId}:`,
      getMetaErrorMessage(err, err.message)
    );
    return [];
  }
}

async function discoverWabas(accessToken, debugData) {
  const discovered = new Map();
  const businessId = extractBusinessId(debugData);

  const scopeWabaIds = debugData?.granular_scopes
    ?.filter((scope) => scope.scope === 'whatsapp_business_messaging')
    .flatMap((scope) => Array.isArray(scope.target_ids) ? scope.target_ids : []) || [];

  for (const scopeWabaId of scopeWabaIds) {
    discovered.set(String(scopeWabaId), {
      id: String(scopeWabaId),
      name: null,
    });
  }

  const [clientWabas, ownedWabas] = await Promise.all([
    fetchWabaListFromBusinessEdge(accessToken, businessId, 'client_whatsapp_business_accounts'),
    fetchWabaListFromBusinessEdge(accessToken, businessId, 'owned_whatsapp_business_accounts'),
  ]);

  for (const waba of [...clientWabas, ...ownedWabas]) {
    if (!waba?.id) {
      continue;
    }

    discovered.set(String(waba.id), {
      id: String(waba.id),
      name: waba.name || discovered.get(String(waba.id))?.name || null,
    });
  }

  return {
    businessId: businessId ? String(businessId) : null,
    wabas: Array.from(discovered.values()),
  };
}

async function fetchWabaPhoneNumbers(accessToken, waba) {
  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/${waba.id}/phone_numbers`,
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 15000,
      }
    );

    const phoneNumbers = Array.isArray(response.data?.data) ? response.data.data : [];
    return phoneNumbers.map((phone) => ({
      waba_id: String(waba.id),
      waba_name: waba.name || null,
      phone_number_id: String(phone.id),
      display_phone: phone.display_phone_number || null,
      verified_name: phone.verified_name || waba.name || null,
      quality_rating: normalizeQualityRating(phone.quality_rating),
      messaging_limit: phone.throughput?.level || null,
      platform_type: phone.platform_type || 'CLOUD_API',
    }));
  } catch (err) {
    console.warn(
      `[whatsapp-service] Failed to fetch phone numbers for WABA ${waba.id}:`,
      getMetaErrorMessage(err, err.message)
    );
    return [];
  }
}

async function discoverEmbeddedSignupAccounts(accessToken) {
  const debugData = await debugAccessToken(accessToken);
  const { businessId, wabas } = await discoverWabas(accessToken, debugData);

  if (!wabas.length) {
    throw AppError.badRequest(
      'No WhatsApp Business Accounts were returned by Meta. Complete the Embedded Signup share step and try again.'
    );
  }

  const phoneNumbersNested = await Promise.all(
    wabas.map((waba) => fetchWabaPhoneNumbers(accessToken, waba))
  );

  const phoneMap = new Map();
  for (const phones of phoneNumbersNested) {
    for (const phone of phones) {
      phoneMap.set(String(phone.phone_number_id), phone);
    }
  }

  const discoveredPhones = Array.from(phoneMap.values());
  if (!discoveredPhones.length) {
    throw AppError.badRequest(
      'Meta did not return any phone numbers for the selected WhatsApp Business Accounts.'
    );
  }

  return {
    businessId,
    wabas,
    discoveredPhones,
  };
}

async function getExistingAccountsByPhoneNumber(userId, phoneNumberIds) {
  const records = await WaAccount.unscoped().findAll({
    where: {
      user_id: userId,
      phone_number_id: phoneNumberIds.map((phoneNumberId) => String(phoneNumberId)),
    },
    paranoid: false,
  });

  return new Map(records.map((record) => [String(record.phone_number_id), record]));
}

async function previewEmbeddedSignup(userId, code, redis) {
  const accessToken = await exchangeCodeForAccessToken(code);
  const discovery = await discoverEmbeddedSignupAccounts(accessToken);
  const phoneNumberIds = discovery.discoveredPhones.map((phone) => phone.phone_number_id);
  const [existingAccounts, connectedWabas] = await Promise.all([
    getExistingAccountsByPhoneNumber(userId, phoneNumberIds),
    getConnectedOrganizationWabas(userId),
  ]);
  const slotStatus = await getRemainingWhatsAppSlots(userId);
  const providerReadiness = buildProviderReadiness(Boolean(redis));
  const organizationWabaId = connectedWabas[0] || null;
  const warnings = [...providerReadiness.warnings];

  if (connectedWabas.length > 1) {
    warnings.push(
      'This organization currently has more than one WABA connected. Finish migration before adding more phone numbers.'
    );
  }

  const signupSessionId = await saveSignupSession(redis, {
    userId,
    businessId: discovery.businessId,
    accessToken,
    wabas: discovery.wabas,
    discoveredPhones: discovery.discoveredPhones,
  });

  return {
    signup_session_id: signupSessionId,
    business_id: discovery.businessId,
    remaining_slots: slotStatus.remainingSlots,
    organization_waba_id: organizationWabaId,
    wabas: summarizeWabas(discovery.discoveredPhones),
    provider_readiness: providerReadiness,
    accounts: discovery.discoveredPhones.map((phone) =>
      serializeDiscoveredPhone(
        phone,
        existingAccounts.get(String(phone.phone_number_id)),
        organizationWabaId
      )
    ),
    warnings,
  };
}

async function subscribeAppToWaba(accessToken, wabaId) {
  const subscribedApps = await fetchSubscribedApps(accessToken, wabaId);
  const existingApp = subscribedApps.find((app) => String(app.id || '') === String(config.meta.appId));

  if (existingApp) {
    return {
      status: 'already_subscribed',
      raw: existingApp,
      callback_override_applied: Boolean(config.meta.overrideCallbackUrl),
    };
  }

  const payload = config.meta.overrideCallbackUrl
    ? {
      override_callback_uri: config.meta.overrideCallbackUrl,
      verify_token: config.meta.webhookVerifyToken,
    }
    : {};

  try {
    const response = await axios.post(
      `${config.meta.baseUrl}/${wabaId}/subscribed_apps`,
      payload,
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 10000,
      }
    );

    return {
      status: 'subscribed',
      raw: response.data || null,
      callback_override_applied: Boolean(config.meta.overrideCallbackUrl),
    };
  } catch (err) {
    throw AppError.badRequest(
      `Failed to subscribe the Nyife app to WABA ${wabaId}. ${getMetaErrorMessage(err, 'App subscription failed.')}`
    );
  }
}

async function fetchSubscribedApps(accessToken, wabaId) {
  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/${wabaId}/subscribed_apps`,
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 10000,
      }
    );

    return Array.isArray(response.data?.data) ? response.data.data : [];
  } catch (err) {
    throw AppError.badRequest(
      `Failed to fetch app subscriptions for WABA ${wabaId}. ${getMetaErrorMessage(err, 'Subscription lookup failed.')}`
    );
  }
}

async function fetchProviderSystemUsers() {
  const response = await axios.get(
    `${config.meta.baseUrl}/${config.meta.providerBusinessId}/system_users`,
    {
      headers: buildMetaHeaders(config.meta.systemUserAccessToken),
      timeout: 15000,
    }
  );

  return Array.isArray(response.data?.data) ? response.data.data : [];
}

async function ensureProviderSystemUserConfigured() {
  if (!hasProviderManagementConfig()) {
    throw new AppError(
      'Provider-managed Meta credentials are incomplete. Configure META_SYSTEM_USER_ACCESS_TOKEN, META_SYSTEM_USER_ID, and META_PROVIDER_BUSINESS_ID.',
      503
    );
  }

  const users = await fetchProviderSystemUsers();
  const found = users.find((user) => String(user.id) === String(config.meta.systemUserId));
  if (!found) {
    throw AppError.badRequest(
      `Configured Meta system user ${config.meta.systemUserId} was not found under provider business ${config.meta.providerBusinessId}.`
    );
  }

  return found;
}

async function assignSystemUserToWaba(wabaId) {
  const existingAssignment = await verifyAssignedSystemUser(wabaId).catch(() => null);
  if (existingAssignment) {
    return {
      status: 'already_assigned',
      assigned_user_id: String(existingAssignment.id),
    };
  }

  try {
    await axios.post(
      `${config.meta.baseUrl}/${wabaId}/assigned_users`,
      null,
      {
        params: {
          user: config.meta.systemUserId,
          tasks: "['MANAGE']",
        },
        headers: buildMetaHeaders(config.meta.systemUserAccessToken),
        timeout: 15000,
      }
    );
    return {
      status: 'assigned',
      assigned_user_id: String(config.meta.systemUserId),
    };
  } catch (err) {
    throw AppError.badRequest(
      `Failed to assign Nyife's Meta system user to WABA ${wabaId}. ${getMetaErrorMessage(err, 'System user assignment failed.')}`
    );
  }
}

async function verifyAssignedSystemUser(wabaId) {
  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/${wabaId}/assigned_users`,
      {
        params: {
          business: config.meta.providerBusinessId,
        },
        headers: buildMetaHeaders(config.meta.systemUserAccessToken),
        timeout: 15000,
      }
    );

    const assignedUsers = Array.isArray(response.data?.data) ? response.data.data : [];
    const found = assignedUsers.find((user) => String(user.id) === String(config.meta.systemUserId));
    if (!found) {
      throw AppError.badRequest(
        `Meta did not report Nyife's configured system user as assigned to WABA ${wabaId}.`
      );
    }

    return found;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    throw AppError.badRequest(
      `Failed to verify system user assignment for WABA ${wabaId}. ${getMetaErrorMessage(err, 'Assigned user lookup failed.')}`
    );
  }
}

async function attachCreditLineToWaba(wabaId) {
  if (!config.meta.enableCreditSharing) {
    return {
      status: 'not_required',
      warning: null,
    };
  }

  if (!config.meta.creditLineId) {
    return {
      status: 'failed',
      warning: 'META_CREDIT_LINE_ID is not configured, so credit sharing was skipped.',
    };
  }

  try {
    await axios.post(
      `${config.meta.baseUrl}/${config.meta.creditLineId}/whatsapp_credit_sharing_and_attach`,
      null,
      {
        params: {
          waba_id: String(wabaId),
          waba_currency: config.meta.creditLineCurrency,
        },
        headers: buildMetaHeaders(config.meta.systemUserAccessToken),
        timeout: 15000,
      }
    );

    return {
      status: 'attached',
      warning: null,
    };
  } catch (err) {
    return {
      status: 'failed',
      warning: `Credit line attachment failed for WABA ${wabaId}. ${getMetaErrorMessage(err, 'Credit sharing failed.')}`,
    };
  }
}

async function createOnboardingAttempt({
  userId,
  waAccountId = null,
  signupSessionId = null,
  businessId = null,
  wabaId,
  phoneNumberId,
  status = 'pending',
}) {
  return WaOnboardingAttempt.create({
    user_id: userId,
    wa_account_id: waAccountId,
    signup_session_id: signupSessionId,
    business_id: businessId,
    waba_id: String(wabaId),
    phone_number_id: String(phoneNumberId),
    status,
    step_details: [],
    warnings: [],
  });
}

async function updateOnboardingAttempt(attempt, fields) {
  if (!attempt) {
    return;
  }

  await attempt.update(fields);
}

async function fetchPhoneNumberHealth(accessToken, phoneNumberId) {
  const response = await axios.get(
    `${config.meta.baseUrl}/${phoneNumberId}`,
    {
      params: {
        fields: 'verified_name,display_phone_number,quality_rating,name_status,status,code_verification_status,messaging_limit_tier',
      },
      headers: buildMetaHeaders(accessToken),
      timeout: 15000,
    }
  );

  return response.data || null;
}

async function fetchAccountReviewStatus(accessToken, wabaId) {
  const response = await axios.get(
    `${config.meta.baseUrl}/${wabaId}`,
    {
      params: {
        fields: 'account_review_status',
      },
      headers: buildMetaHeaders(accessToken),
      timeout: 15000,
    }
  );

  return response.data?.account_review_status || null;
}

function applyResolvedPhoneMetadata(phone, phoneDetails, accountReviewStatus) {
  return {
    ...phone,
    display_phone: phoneDetails?.display_phone_number || phone.display_phone || null,
    verified_name: phoneDetails?.verified_name || phone.verified_name || null,
    quality_rating: normalizeQualityRating(phoneDetails?.quality_rating ?? phone.quality_rating),
    name_status: phoneDetails?.name_status || null,
    number_status: phoneDetails?.status || null,
    code_verification_status: phoneDetails?.code_verification_status || null,
    account_review_status: accountReviewStatus || null,
    messaging_limit: phoneDetails?.messaging_limit_tier || phone.messaging_limit || null,
  };
}

async function setTwoStepVerificationPin(accessToken, phoneNumberId, pin) {
  try {
    await axios.post(
      `${config.meta.baseUrl}/${phoneNumberId}`,
      { pin },
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 15000,
      }
    );
  } catch (err) {
    throw AppError.badRequest(
      `Failed to update Meta two-step verification for phone number ${phoneNumberId}. ${getMetaErrorMessage(err, 'Two-step verification update failed.')}`
    );
  }
}

async function registerPhoneNumber(accessToken, phoneNumberId, displayPhone, options = {}) {
  const { repairMode = false } = options;
  const payload = buildRegisterPhonePayload(displayPhone);

  try {
    await axios.post(
      `https://graph.facebook.com/${REGISTER_ENDPOINT_GRAPH_API_VERSION}/${phoneNumberId}/register`,
      payload,
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 15000,
      }
    );
  } catch (err) {
    if (getMetaErrorCode(err) === '133005') {
      throw AppError.badRequest(
        repairMode
          ? `Failed to register phone number ${phoneNumberId} after resetting the shared legacy PIN. ${getMetaErrorMessage(err, 'Phone registration failed.')}`
          : getLegacyPinRepairMessage(phoneNumberId)
      );
    }

    throw AppError.badRequest(
      `Failed to register phone number ${phoneNumberId} with Meta. ${getMetaErrorMessage(err, 'Phone registration failed.')}`
    );
  }
}

async function ensurePhoneRegistrationForSignup(accessToken, phone) {
  const phoneNumberId = String(phone.phone_number_id);
  const phoneDetails = await fetchPhoneNumberHealth(accessToken, phoneNumberId);
  const currentStatus = phoneDetails?.status || null;
  const displayPhone = phoneDetails?.display_phone_number || phone.display_phone || null;

  if (isPhoneConnectedStatus(currentStatus)) {
    return {
      skipped: true,
      statusBefore: currentStatus,
      phoneDetails,
    };
  }

  await registerPhoneNumber(accessToken, phoneNumberId, displayPhone);

  return {
    skipped: false,
    statusBefore: currentStatus,
    phoneDetails,
  };
}

async function repairLegacyRegistrationCompatibility(accessToken, phone) {
  const phoneNumberId = String(phone.phone_number_id);
  const phoneDetails = await fetchPhoneNumberHealth(accessToken, phoneNumberId);
  const currentStatus = phoneDetails?.status || null;
  const displayPhone = phoneDetails?.display_phone_number || phone.display_phone || null;

  await setTwoStepVerificationPin(accessToken, phoneNumberId, LEGACY_EMBEDDED_SIGNUP_PIN);

  if (isPhoneConnectedStatus(currentStatus)) {
    return {
      pinReset: true,
      registered: false,
      statusBefore: currentStatus,
      phoneDetails,
    };
  }

  await registerPhoneNumber(accessToken, phoneNumberId, displayPhone, { repairMode: true });

  return {
    pinReset: true,
    registered: true,
    statusBefore: currentStatus,
    phoneDetails,
  };
}

async function upsertConnectedAccount(
  userId,
  accessToken,
  businessId,
  phone,
  existingAccount,
  registrationPin,
  metadata = {}
) {
  const encryptedToken = accessToken ? encrypt(accessToken) : null;
  const encryptedRegistrationPin = encrypt(registrationPin);
  const webhookSecret = existingAccount?.webhook_secret || crypto.randomBytes(32).toString('hex');
  const shouldIncrementUsage = !existingAccount || existingAccount.deleted_at || existingAccount.status !== 'active';
  const updatePayload = {
    access_token: encryptedToken,
    registration_pin: encryptedRegistrationPin,
    waba_id: String(phone.waba_id),
    phone_number_id: String(phone.phone_number_id),
    display_phone: phone.display_phone || null,
    verified_name: phone.verified_name || null,
    business_id: businessId ? String(businessId) : null,
    quality_rating: normalizeQualityRating(phone.quality_rating),
    name_status: phone.name_status || null,
    number_status: phone.number_status || null,
    code_verification_status: phone.code_verification_status || null,
    account_review_status: phone.account_review_status || null,
    messaging_limit: phone.messaging_limit || null,
    platform_type: phone.platform_type || 'CLOUD_API',
    status: 'active',
    credential_source: metadata.credential_source || META_CREDENTIAL_SOURCES.LEGACY_EMBEDDED_USER_TOKEN,
    assigned_system_user_id: metadata.assigned_system_user_id || null,
    app_subscription_status: metadata.app_subscription_status || 'unknown',
    credit_sharing_status: metadata.credit_sharing_status || 'unknown',
    onboarding_status: metadata.onboarding_status || 'active',
    last_health_checked_at: metadata.last_health_checked_at || null,
    last_onboarded_at: metadata.last_onboarded_at || new Date(),
    last_onboarding_error: metadata.last_onboarding_error || null,
    webhook_secret: webhookSecret,
  };

  if (existingAccount) {
    if (existingAccount.deleted_at) {
      await existingAccount.restore();
    }

    await existingAccount.update(updatePayload);

    return {
      account: existingAccount,
      usageDelta: shouldIncrementUsage ? 1 : 0,
    };
  }

  const account = await WaAccount.create({
    user_id: userId,
    ...updatePayload,
  });

  return {
    account,
    usageDelta: 1,
  };
}

function buildAttemptResult(phone, account, status, steps, warnings, extra = {}) {
  return {
    waba_id: String(phone.waba_id),
    phone_number_id: String(phone.phone_number_id),
    status,
    steps,
    warnings,
    account: sanitizeConnectedAccount(account),
    ...extra,
  };
}

async function publishAccountLifecycle(kafkaProducer, account, lifecycleType, extra = {}) {
  if (!kafkaProducer || !account) {
    return;
  }

  try {
    await publishEvent(kafkaProducer, TOPICS.WHATSAPP_ACCOUNT_LIFECYCLE, account.id, {
      userId: account.user_id,
      waAccountId: account.id,
      wabaId: String(account.waba_id),
      phoneNumberId: String(account.phone_number_id),
      lifecycleType,
      accountStatus: account.status,
      onboardingStatus: account.onboarding_status,
      qualityRating: account.quality_rating || null,
      messagingLimit: account.messaging_limit || null,
      appSubscriptionStatus: account.app_subscription_status || null,
      creditSharingStatus: account.credit_sharing_status || null,
      steps: extra.steps,
      error: extra.error || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[whatsapp-service] Failed to publish account lifecycle event:', err.message);
  }
}

async function completeEmbeddedSignup(userId, signupSessionId, selectedWabaId, phoneNumberIds, redis, kafkaProducer = null) {
  const session = await loadSignupSession(redis, signupSessionId);

  if (session.userId !== userId) {
    throw AppError.forbidden('Embedded signup session does not belong to the current tenant.');
  }

  const uniquePhoneNumberIds = [...new Set((phoneNumberIds || []).map((value) => String(value)))];
  if (!uniquePhoneNumberIds.length) {
    throw AppError.badRequest('Choose at least one phone number to connect.');
  }

  const discoveredPhones = Array.isArray(session.discoveredPhones) ? session.discoveredPhones : [];
  const discoveredPhoneMap = new Map(
    discoveredPhones.map((phone) => [String(phone.phone_number_id), phone])
  );

  const selectedPhones = uniquePhoneNumberIds.map((phoneNumberId) => {
    const phone = discoveredPhoneMap.get(phoneNumberId);
    if (!phone) {
      throw AppError.badRequest(`Phone number ${phoneNumberId} is not part of the current signup session.`);
    }
    return phone;
  });

  const [existingAccounts, connectedWabas] = await Promise.all([
    getExistingAccountsByPhoneNumber(userId, uniquePhoneNumberIds),
    getConnectedOrganizationWabas(userId),
  ]);
  const slotStatus = await getRemainingWhatsAppSlots(userId);
  const providerReadiness = buildProviderReadiness(Boolean(redis));
  const providerConfigured = providerReadiness.provider_configured;
  const organizationWabaId = connectedWabas[0] || null;

  if (connectedWabas.length > 1) {
    throw AppError.badRequest(
      'This organization already has multiple WABAs connected. Finish the migration before connecting more phone numbers.'
    );
  }

  if (organizationWabaId && selectedWabaId && String(selectedWabaId) !== String(organizationWabaId)) {
    throw AppError.badRequest(
      'This organization already has a WhatsApp Business Account connected. You can only add phone numbers from that same WABA.'
    );
  }

  const resolvedWabaId = organizationWabaId || selectedWabaId || null;
  const distinctSelectedWabas = [...new Set(selectedPhones.map((phone) => String(phone.waba_id)))];

  if (!resolvedWabaId && distinctSelectedWabas.length > 1) {
    throw AppError.badRequest('Select exactly one WhatsApp Business Account before connecting phone numbers.');
  }

  const enforcedWabaId = resolvedWabaId || distinctSelectedWabas[0] || null;
  if (!enforcedWabaId) {
    throw AppError.badRequest('Select a WhatsApp Business Account before connecting phone numbers.');
  }

  const hasCrossWabaSelection = selectedPhones.some(
    (phone) => String(phone.waba_id) !== String(enforcedWabaId)
  );
  if (hasCrossWabaSelection) {
    throw AppError.badRequest(
      'Choose phone numbers from a single WhatsApp Business Account for this organization.'
    );
  }

  if (!slotStatus.hasActiveSubscription) {
    throw AppError.forbidden('An active subscription is required before connecting WhatsApp numbers.');
  }

  const additionalNumbersNeeded = selectedPhones.filter((phone) => {
    const existingAccount = existingAccounts.get(String(phone.phone_number_id));
    return !existingAccount || existingAccount.deleted_at || existingAccount.status !== 'active';
  }).length;

  if (
    slotStatus.remainingSlots !== null
    && additionalNumbersNeeded > slotStatus.remainingSlots
  ) {
    throw AppError.forbidden(
      `Your subscription allows ${slotStatus.remainingSlots} more WhatsApp number(s). Reduce the selection or upgrade the plan.`
    );
  }

  if (!providerConfigured && !config.meta.allowLegacyAccountTokenFallback) {
    throw new AppError(
      'Provider-managed Meta credentials are required before Nyife can complete Embedded Signup in this environment.',
      503
    );
  }

  if (providerConfigured) {
    await ensureProviderSystemUserConfigured();
  }

  const connectedAccounts = [];
  const skipped = [];
  const results = [];
  const warnings = [...providerReadiness.warnings];
  let usageDelta = 0;

  for (const phone of selectedPhones) {
    const existingAccount = existingAccounts.get(String(phone.phone_number_id));
    const alreadyConnected = Boolean(
      existingAccount
      && !existingAccount.deleted_at
      && existingAccount.status === 'active'
    );

    if (alreadyConnected) {
      skipped.push({
        phone_number_id: String(phone.phone_number_id),
        reason: 'already_connected',
      });
      connectedAccounts.push(sanitizeConnectedAccount(existingAccount));
      results.push(buildAttemptResult(phone, existingAccount, 'already_connected', [
        createStep('onboarding', ONBOARDING_STEP_SKIPPED, 'This phone number is already connected for this tenant.'),
      ], []));
      continue;
    }

    const registrationPin = resolveRegistrationPin();
    const attempt = await createOnboardingAttempt({
      userId,
      waAccountId: existingAccount?.id || null,
      signupSessionId,
      businessId: session.businessId || null,
      wabaId: phone.waba_id,
      phoneNumberId: phone.phone_number_id,
      status: 'in_progress',
    });

    const stepDetails = [];
    const localWarnings = [];

    try {
      if (providerConfigured) {
        const assignmentResult = await assignSystemUserToWaba(phone.waba_id);
        stepDetails.push(
          createStep(
            'assign_system_user',
            assignmentResult.status === 'already_assigned' ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED,
            assignmentResult.status === 'already_assigned'
              ? 'Nyife system user was already assigned to the WABA.'
              : 'Nyife system user assigned to the WABA.',
            assignmentResult
          )
        );
        await updateOnboardingAttempt(attempt, { step_details: stepDetails });

        await verifyAssignedSystemUser(phone.waba_id);
        stepDetails.push(
          createStep('verify_system_user_assignment', ONBOARDING_STEP_COMPLETED, 'Meta confirmed the system user assignment.')
        );
        await updateOnboardingAttempt(attempt, { step_details: stepDetails });
      } else {
        stepDetails.push(
          createStep(
            'assign_system_user',
            ONBOARDING_STEP_SKIPPED,
            'Nyife is using the standard Embedded Signup connection flow for this account.'
          )
        );
      }

      const managementToken = providerConfigured ? config.meta.systemUserAccessToken : session.accessToken;

      const subscriptionResult = await subscribeAppToWaba(managementToken, phone.waba_id);
      stepDetails.push(
        createStep(
          'subscribe_app',
          subscriptionResult.status === 'already_subscribed' ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED,
          subscriptionResult.status === 'already_subscribed'
            ? 'Nyife app was already subscribed to the WABA.'
            : 'Nyife app subscribed to the WABA.',
          subscriptionResult
        )
      );
      await updateOnboardingAttempt(attempt, { step_details: stepDetails });

      const creditResult = providerConfigured
        ? await attachCreditLineToWaba(phone.waba_id)
        : { status: 'not_required', warning: null };

      if (creditResult.warning) {
        localWarnings.push(creditResult.warning);
      }
      stepDetails.push(
        createStep(
          'attach_credit_line',
          creditResult.status === 'failed' ? ONBOARDING_STEP_FAILED : (creditResult.status === 'not_required' ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED),
          creditResult.warning || `Credit sharing status: ${creditResult.status}.`,
          { credit_sharing_status: creditResult.status }
        )
      );
      await updateOnboardingAttempt(attempt, {
        step_details: stepDetails,
        warnings: localWarnings,
      });

      const registrationResult = await ensurePhoneRegistrationForSignup(
        managementToken,
        phone
      );
      stepDetails.push(
        createStep(
          'register_phone',
          registrationResult.skipped ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED,
          registrationResult.skipped
            ? 'Phone number was already connected in Meta, so registration was skipped.'
            : 'Phone number registered successfully with Meta.',
          {
            number_status_before_registration: registrationResult.statusBefore,
            legacy_pin: LEGACY_EMBEDDED_SIGNUP_PIN,
          }
        )
      );
      await updateOnboardingAttempt(attempt, { step_details: stepDetails });

      const [phoneDetailsResult, accountReviewResult] = await Promise.allSettled([
        fetchPhoneNumberHealth(managementToken, String(phone.phone_number_id)),
        fetchAccountReviewStatus(managementToken, String(phone.waba_id)),
      ]);

      const hydratedPhone = applyResolvedPhoneMetadata(
        phone,
        phoneDetailsResult.status === 'fulfilled' ? phoneDetailsResult.value : null,
        accountReviewResult.status === 'fulfilled' ? accountReviewResult.value : null
      );

      const result = await upsertConnectedAccount(
        userId,
        providerConfigured ? null : session.accessToken,
        session.businessId,
        hydratedPhone,
        existingAccount,
        registrationPin,
        {
          credential_source: providerConfigured
            ? META_CREDENTIAL_SOURCES.PROVIDER_SYSTEM_USER
            : META_CREDENTIAL_SOURCES.LEGACY_EMBEDDED_USER_TOKEN,
          assigned_system_user_id: providerConfigured ? config.meta.systemUserId : null,
          app_subscription_status: 'subscribed',
          credit_sharing_status: creditResult.status || 'unknown',
          onboarding_status: 'active',
          last_onboarded_at: new Date(),
          last_onboarding_error: null,
        }
      );

      stepDetails.push(
        createStep('activate_account', ONBOARDING_STEP_COMPLETED, 'The WhatsApp account is active in Nyife.')
      );

      usageDelta += result.usageDelta;
      connectedAccounts.push(sanitizeConnectedAccount(result.account));
      await updateOnboardingAttempt(attempt, {
        wa_account_id: result.account.id,
        status: 'completed',
        step_details: stepDetails,
        warnings: localWarnings,
        last_error: null,
        is_retryable: false,
      });
      results.push(buildAttemptResult(hydratedPhone, result.account, 'active', stepDetails, localWarnings));
      await publishAccountLifecycle(kafkaProducer, result.account, 'onboarding_completed', {
        steps: stepDetails,
      });
    } catch (err) {
      const failureMessage = err instanceof AppError ? err.message : getMetaErrorMessage(err, err.message);
      stepDetails.push(
        createStep('onboarding_failed', ONBOARDING_STEP_FAILED, failureMessage)
      );

      await updateOnboardingAttempt(attempt, {
        wa_account_id: existingAccount?.id || null,
        status: 'failed',
        step_details: stepDetails,
        warnings: localWarnings,
        last_error: failureMessage,
        is_retryable: true,
      });

      if (existingAccount) {
        await existingAccount.update({
          onboarding_status: 'failed',
          last_onboarding_error: failureMessage,
        });
        await publishAccountLifecycle(kafkaProducer, existingAccount, 'onboarding_failed', {
          steps: stepDetails,
          error: failureMessage,
        });
      }

      warnings.push(failureMessage);
      results.push(buildAttemptResult(phone, existingAccount, 'failed', stepDetails, localWarnings, {
        error: failureMessage,
      }));
    }
  }

  if (usageDelta) {
    await adjustWhatsAppNumberUsage(userId, usageDelta);
  }

  await deleteSignupSession(redis, signupSessionId);

  return {
    accounts: connectedAccounts.filter(Boolean),
    connected_count: connectedAccounts.length - skipped.length,
    skipped,
    warnings: [...new Set(warnings)],
    results,
  };
}

async function listAccounts(userId) {
  const accounts = await WaAccount.findAll({
    where: { user_id: userId },
    order: [['updated_at', 'DESC']],
  });

  return accounts.map((account) => account.toSafeJSON());
}

async function getAccount(userId, accountId) {
  const account = await WaAccount.findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  return account.toSafeJSON();
}

async function deactivateAccount(userId, accountId, kafkaProducer = null) {
  const account = await WaAccount.findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  const wasActive = account.status === 'active';
  await account.update({
    status: 'inactive',
    onboarding_status: 'inactive',
  });

  if (wasActive) {
    await adjustWhatsAppNumberUsage(userId, -1);
  }

  await publishAccountLifecycle(kafkaProducer, account, 'disconnected');

  return account.toSafeJSON();
}

async function getPhoneNumbers(userId, accountId) {
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  const credential = requireResolvedMetaCredential(account);

  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/${account.waba_id}/phone_numbers`,
      {
        headers: buildMetaHeaders(credential.accessToken),
        timeout: 15000,
      }
    );

    return response.data?.data || [];
  } catch (err) {
    throw AppError.badRequest(
      `Failed to fetch phone numbers from Meta. ${getMetaErrorMessage(err, 'Phone number lookup failed.')}`
    );
  }
}

async function getDecryptedToken(accountId) {
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: accountId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  if (account.status !== 'active') {
    throw AppError.forbidden('WhatsApp account is not active');
  }

  const credential = requireResolvedMetaCredential(account);
  return credential.accessToken;
}

async function findByPhoneNumberId(phoneNumberId) {
  return WaAccount.findOne({
    where: {
      phone_number_id: String(phoneNumberId),
      status: 'active',
    },
  });
}

async function updateQualityRating(phoneNumberId, qualityRating) {
  await WaAccount.update(
    {
      quality_rating: normalizeQualityRating(qualityRating),
      last_health_checked_at: new Date(),
    },
    {
      where: { phone_number_id: String(phoneNumberId) },
    }
  );
}

async function updateAccountStatusByWaba(wabaId, status) {
  const validStatuses = ['active', 'inactive', 'restricted', 'banned'];
  if (!validStatuses.includes(status)) {
    return;
  }

  await WaAccount.update(
    {
      status,
      last_health_checked_at: new Date(),
    },
    {
      where: { waba_id: String(wabaId) },
    }
  );
}

async function getAccountHealth(userId, accountId, kafkaProducer = null) {
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  const credential = requireResolvedMetaCredential(account);
  const [phoneDetails, initialSubscribedApps, assignedUser, accountReviewStatus] = await Promise.all([
    fetchPhoneNumberHealth(credential.accessToken, account.phone_number_id),
    fetchSubscribedApps(credential.accessToken, account.waba_id),
    hasProviderManagementConfig()
      ? verifyAssignedSystemUser(account.waba_id).catch(() => null)
      : Promise.resolve(null),
    fetchAccountReviewStatus(credential.accessToken, account.waba_id).catch(() => null),
  ]);

  let subscribedApps = initialSubscribedApps;
  let appSubscribed = subscribedApps.some((app) => String(app.id || '') === String(config.meta.appId));
  const warnings = [];

  if (!appSubscribed) {
    try {
      await subscribeAppToWaba(credential.accessToken, account.waba_id);
      subscribedApps = await fetchSubscribedApps(credential.accessToken, account.waba_id);
      appSubscribed = subscribedApps.some((app) => String(app.id || '') === String(config.meta.appId));
    } catch (err) {
      warnings.push(
        `Nyife could not refresh the webhook subscription automatically. ${getMetaErrorMessage(err, 'Reconnect the account if inbound sync stops working.')}`
      );
    }
  }

  if (!appSubscribed) {
    warnings.push('Webhook subscription could not be confirmed. Inbound chat or message-status sync may be delayed.');
  }

  if (phoneDetails?.name_status && String(phoneDetails.name_status).toUpperCase() !== 'APPROVED') {
    warnings.push(`Display name review status is ${phoneDetails.name_status}.`);
  }

  if (accountReviewStatus && String(accountReviewStatus).toUpperCase() !== 'APPROVED') {
    warnings.push(`WhatsApp Business account review status is ${accountReviewStatus}.`);
  }

  const nextAccountStatus = account.status === 'inactive' ? 'inactive' : account.status;

  await account.update({
    verified_name: phoneDetails?.verified_name || account.verified_name,
    display_phone: phoneDetails?.display_phone_number || account.display_phone,
    quality_rating: normalizeQualityRating(phoneDetails?.quality_rating ?? account.quality_rating),
    name_status: phoneDetails?.name_status || account.name_status,
    number_status: phoneDetails?.status || account.number_status,
    code_verification_status: phoneDetails?.code_verification_status || account.code_verification_status,
    account_review_status: accountReviewStatus || account.account_review_status,
    messaging_limit: phoneDetails?.messaging_limit_tier || account.messaging_limit,
    assigned_system_user_id: assignedUser?.id || account.assigned_system_user_id,
    app_subscription_status: appSubscribed ? 'subscribed' : 'not_subscribed',
    onboarding_status:
      nextAccountStatus === 'inactive'
        ? 'inactive'
        : 'active',
    last_health_checked_at: new Date(),
    last_onboarding_error: warnings[0] || null,
  });
  await account.reload();

  await publishAccountLifecycle(kafkaProducer, account, 'health_check');

  return {
    account: account.toSafeJSON(),
    health: {
      provider_configured: hasProviderManagementConfig(),
      assigned_system_user: assignedUser ? { id: String(assignedUser.id) } : null,
      app_subscription_status: account.app_subscription_status,
      name_status: phoneDetails?.name_status || null,
      quality_rating: account.quality_rating,
      subscribed_apps_count: subscribedApps.length,
      warnings,
    },
  };
}

async function reconcileAccount(userId, accountId, kafkaProducer = null) {
  const account = await WaAccount.scope('withAll').findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  const providerConfigured = hasProviderManagementConfig();
  if (providerConfigured) {
    await ensureProviderSystemUserConfigured();
  }

  const phone = {
    waba_id: String(account.waba_id),
    phone_number_id: String(account.phone_number_id),
    display_phone: account.display_phone,
    verified_name: account.verified_name,
    quality_rating: account.quality_rating,
    messaging_limit: account.messaging_limit,
    platform_type: account.platform_type || 'CLOUD_API',
  };

  const attempt = await createOnboardingAttempt({
    userId,
    waAccountId: account.id,
    businessId: account.business_id,
    wabaId: account.waba_id,
    phoneNumberId: account.phone_number_id,
    status: 'reconcile_pending',
  });

  const steps = [];
  const warnings = [];
  const registrationPin = resolveRegistrationPin();
  const credential = requireResolvedMetaCredential(account, {
    allowLegacyAccountTokenFallback: true,
  });

  try {
    if (providerConfigured) {
      const assignmentResult = await assignSystemUserToWaba(account.waba_id);
      steps.push(
        createStep(
          'assign_system_user',
          assignmentResult.status === 'already_assigned' ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED,
          assignmentResult.status === 'already_assigned'
            ? 'Nyife system user was already assigned to the WABA.'
            : 'Nyife system user assigned to the WABA.',
          assignmentResult
        )
      );
      await verifyAssignedSystemUser(account.waba_id);
      steps.push(createStep('verify_system_user_assignment', ONBOARDING_STEP_COMPLETED, 'Meta confirmed the system user assignment.'));
    } else {
      steps.push(
        createStep(
          'assign_system_user',
          ONBOARDING_STEP_SKIPPED,
          'Repair is using the account-level Embedded Signup token because provider-managed credentials are not configured.'
        )
      );
    }

    const subscriptionResult = await subscribeAppToWaba(credential.accessToken, account.waba_id);
    steps.push(
      createStep(
        'subscribe_app',
        subscriptionResult.status === 'already_subscribed' ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED,
        subscriptionResult.status === 'already_subscribed'
          ? 'Nyife app was already subscribed to the WABA.'
          : 'Nyife app subscribed to the WABA.',
        subscriptionResult
      )
    );

    const creditResult = providerConfigured
      ? await attachCreditLineToWaba(account.waba_id)
      : { status: 'not_required', warning: null };
    if (creditResult.warning) {
      warnings.push(creditResult.warning);
    }
    steps.push(
      createStep(
        'attach_credit_line',
        creditResult.status === 'failed' ? ONBOARDING_STEP_FAILED : (creditResult.status === 'not_required' ? ONBOARDING_STEP_SKIPPED : ONBOARDING_STEP_COMPLETED),
        creditResult.warning || `Credit sharing status: ${creditResult.status}.`,
        { credit_sharing_status: creditResult.status }
      )
    );

    const repairResult = await repairLegacyRegistrationCompatibility(credential.accessToken, phone);
    steps.push(
      createStep(
        'repair_two_step_verification',
        ONBOARDING_STEP_COMPLETED,
        'Shared legacy two-step verification PIN restored for cross-platform compatibility.',
        { legacy_pin: LEGACY_EMBEDDED_SIGNUP_PIN }
      )
    );
    steps.push(
      createStep(
        'register_phone',
        repairResult.registered ? ONBOARDING_STEP_COMPLETED : ONBOARDING_STEP_SKIPPED,
        repairResult.registered
          ? 'Phone number re-registered successfully with Meta after restoring legacy compatibility.'
          : 'Phone number was already connected in Meta, so re-registration was skipped after restoring legacy compatibility.',
        {
          number_status_before_registration: repairResult.statusBefore,
          legacy_pin: LEGACY_EMBEDDED_SIGNUP_PIN,
        }
      )
    );

    const [phoneDetailsResult, accountReviewResult] = await Promise.allSettled([
      fetchPhoneNumberHealth(credential.accessToken, String(account.phone_number_id)),
      fetchAccountReviewStatus(credential.accessToken, String(account.waba_id)),
    ]);

    const hydratedPhone = applyResolvedPhoneMetadata(
      phone,
      phoneDetailsResult.status === 'fulfilled' ? phoneDetailsResult.value : null,
      accountReviewResult.status === 'fulfilled' ? accountReviewResult.value : null
    );

    const result = await upsertConnectedAccount(
      userId,
      credential.source === META_CREDENTIAL_SOURCES.LEGACY_EMBEDDED_USER_TOKEN ? credential.accessToken : null,
      account.business_id,
      hydratedPhone,
      account,
      registrationPin,
      {
        credential_source: credential.source,
        assigned_system_user_id: providerConfigured ? config.meta.systemUserId : account.assigned_system_user_id,
        app_subscription_status: 'subscribed',
        credit_sharing_status: creditResult.status || 'unknown',
        onboarding_status: 'active',
        last_onboarded_at: new Date(),
        last_onboarding_error: null,
      }
    );

    steps.push(
      createStep(
        'activate_account',
        ONBOARDING_STEP_COMPLETED,
        'The WhatsApp account is active in Nyife and compatible with the legacy Nyife signup flow.'
      )
    );
    await updateOnboardingAttempt(attempt, {
      wa_account_id: result.account.id,
      status: 'completed',
      step_details: steps,
      warnings,
      last_error: null,
      is_retryable: false,
    });
    await publishAccountLifecycle(kafkaProducer, result.account, 'reconciled', { steps });

    return {
      account: result.account.toSafeJSON(),
      steps,
      warnings,
    };
  } catch (err) {
    const failureMessage = err instanceof AppError ? err.message : getMetaErrorMessage(err, err.message);
    steps.push(createStep('reconcile_failed', ONBOARDING_STEP_FAILED, failureMessage));
    await account.update({
      onboarding_status: 'failed',
      last_onboarding_error: failureMessage,
    });
    await updateOnboardingAttempt(attempt, {
      wa_account_id: account.id,
      status: 'failed',
      step_details: steps,
      warnings,
      last_error: failureMessage,
      is_retryable: true,
    });
    await publishAccountLifecycle(kafkaProducer, account, 'onboarding_failed', {
      steps,
      error: failureMessage,
    });
    throw AppError.badRequest(failureMessage);
  }
}

module.exports = {
  previewEmbeddedSignup,
  completeEmbeddedSignup,
  listAccounts,
  getAccount,
  deactivateAccount,
  getAccountHealth,
  reconcileAccount,
  getPhoneNumbers,
  getDecryptedToken,
  findByPhoneNumberId,
  updateQualityRating,
  updateAccountStatusByWaba,
  __private: {
    LEGACY_EMBEDDED_SIGNUP_PIN,
    REGISTER_ENDPOINT_GRAPH_API_VERSION,
    resolveRegistrationPin,
    isPhoneConnectedStatus,
    deriveDataLocalizationRegion,
    buildRegisterPhonePayload,
    registerPhoneNumber,
    ensurePhoneRegistrationForSignup,
    repairLegacyRegistrationCompatibility,
  },
};
