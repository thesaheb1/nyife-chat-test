'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { WaAccount } = require('../models');
const { AppError, encrypt, decrypt } = require('@nyife/shared-utils');
const config = require('../config');

const SIGNUP_SESSION_TTL_SECONDS = 10 * 60;
const signupSessionFallbackStore = new Map();

function getMetaErrorMessage(err, fallbackMessage) {
  const metaMessage = err.response?.data?.error?.message;
  return metaMessage || fallbackMessage || err.message;
}

function getMetaErrorCode(err) {
  return String(err.response?.data?.error?.code || '');
}

function buildMetaHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function generateRegistrationPin() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function resolveRegistrationPin(existingAccount) {
  if (!existingAccount?.registration_pin) {
    return generateRegistrationPin();
  }

  try {
    return decrypt(existingAccount.registration_pin);
  } catch (err) {
    console.warn(
      `[whatsapp-service] Failed to decrypt stored registration PIN for account ${existingAccount.id}:`,
      err.message
    );
    return generateRegistrationPin();
  }
}

function sanitizeConnectedAccount(account) {
  return account ? account.toSafeJSON() : null;
}

function serializeDiscoveredPhone(phone, existingAccount) {
  const alreadyConnected = Boolean(
    existingAccount
    && !existingAccount.deleted_at
    && existingAccount.status === 'active'
  );

  return {
    waba_id: String(phone.waba_id),
    phone_number_id: String(phone.phone_number_id),
    display_phone: phone.display_phone || null,
    verified_name: phone.verified_name || null,
    quality_rating: phone.quality_rating || null,
    already_connected: alreadyConnected,
    eligible: !alreadyConnected,
    existing_account_id: existingAccount?.id || null,
  };
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
      quality_rating: phone.quality_rating || null,
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
  const existingAccounts = await getExistingAccountsByPhoneNumber(userId, phoneNumberIds);
  const slotStatus = await getRemainingWhatsAppSlots(userId);

  const signupSessionId = await saveSignupSession(redis, {
    userId,
    businessId: discovery.businessId,
    accessToken,
    discoveredPhones: discovery.discoveredPhones,
  });

  return {
    signup_session_id: signupSessionId,
    remaining_slots: slotStatus.remainingSlots,
    accounts: discovery.discoveredPhones.map((phone) =>
      serializeDiscoveredPhone(phone, existingAccounts.get(String(phone.phone_number_id)))
    ),
  };
}

async function subscribeAppToWaba(accessToken, wabaId) {
  try {
    await axios.post(
      `${config.meta.baseUrl}/${wabaId}/subscribed_apps`,
      {},
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 10000,
      }
    );
  } catch (err) {
    console.warn(
      `[whatsapp-service] Could not subscribe app to WABA ${wabaId}:`,
      getMetaErrorMessage(err, err.message)
    );
  }
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

async function registerPhoneNumber(accessToken, phoneNumberId, pin) {
  try {
    await axios.post(
      `${config.meta.baseUrl}/${phoneNumberId}/register`,
      {
        messaging_product: 'whatsapp',
        pin,
      },
      {
        headers: buildMetaHeaders(accessToken),
        timeout: 15000,
      }
    );
  } catch (err) {
    if (getMetaErrorCode(err) === '133005') {
      await setTwoStepVerificationPin(accessToken, phoneNumberId, pin);

      try {
        await axios.post(
          `${config.meta.baseUrl}/${phoneNumberId}/register`,
          {
            messaging_product: 'whatsapp',
            pin,
          },
          {
            headers: buildMetaHeaders(accessToken),
            timeout: 15000,
          }
        );
        return;
      } catch (retryErr) {
        throw AppError.badRequest(
          `Failed to register phone number ${phoneNumberId} with Meta after refreshing the two-step verification PIN. ${getMetaErrorMessage(retryErr, 'Phone registration failed.')}`
        );
      }
    }

    throw AppError.badRequest(
      `Failed to register phone number ${phoneNumberId} with Meta. ${getMetaErrorMessage(err, 'Phone registration failed.')}`
    );
  }
}

async function upsertConnectedAccount(
  userId,
  accessToken,
  businessId,
  phone,
  existingAccount,
  registrationPin
) {
  const encryptedToken = encrypt(accessToken);
  const encryptedRegistrationPin = encrypt(registrationPin);
  const webhookSecret = existingAccount?.webhook_secret || crypto.randomBytes(32).toString('hex');
  const shouldIncrementUsage = !existingAccount || existingAccount.deleted_at || existingAccount.status !== 'active';

  if (existingAccount) {
    if (existingAccount.deleted_at) {
      await existingAccount.restore();
    }

    await existingAccount.update({
      access_token: encryptedToken,
      registration_pin: encryptedRegistrationPin,
      waba_id: String(phone.waba_id),
      phone_number_id: String(phone.phone_number_id),
      display_phone: phone.display_phone || null,
      verified_name: phone.verified_name || null,
      business_id: businessId ? String(businessId) : null,
      quality_rating: phone.quality_rating || null,
      messaging_limit: phone.messaging_limit || null,
      platform_type: phone.platform_type || 'CLOUD_API',
      status: 'active',
      webhook_secret: webhookSecret,
    });

    return {
      account: existingAccount,
      usageDelta: shouldIncrementUsage ? 1 : 0,
    };
  }

  const account = await WaAccount.create({
    user_id: userId,
    waba_id: String(phone.waba_id),
    phone_number_id: String(phone.phone_number_id),
    display_phone: phone.display_phone || null,
    verified_name: phone.verified_name || null,
    business_id: businessId ? String(businessId) : null,
    access_token: encryptedToken,
    registration_pin: encryptedRegistrationPin,
    quality_rating: phone.quality_rating || null,
    messaging_limit: phone.messaging_limit || null,
    platform_type: phone.platform_type || 'CLOUD_API',
    status: 'active',
    webhook_secret: webhookSecret,
  });

  return {
    account,
    usageDelta: 1,
  };
}

async function completeEmbeddedSignup(userId, signupSessionId, phoneNumberIds, redis) {
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

  const existingAccounts = await getExistingAccountsByPhoneNumber(userId, uniquePhoneNumberIds);
  const slotStatus = await getRemainingWhatsAppSlots(userId);

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

  const uniqueWabaIds = [...new Set(selectedPhones.map((phone) => String(phone.waba_id)))];
  await Promise.all(uniqueWabaIds.map((wabaId) => subscribeAppToWaba(session.accessToken, wabaId)));

  const connectedAccounts = [];
  const skipped = [];
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
      continue;
    }

    const registrationPin = resolveRegistrationPin(existingAccount);

    await registerPhoneNumber(
      session.accessToken,
      String(phone.phone_number_id),
      registrationPin
    );

    const result = await upsertConnectedAccount(
      userId,
      session.accessToken,
      session.businessId,
      phone,
      existingAccount,
      registrationPin
    );

    usageDelta += result.usageDelta;
    connectedAccounts.push(sanitizeConnectedAccount(result.account));
  }

  if (usageDelta) {
    await adjustWhatsAppNumberUsage(userId, usageDelta);
  }

  await deleteSignupSession(redis, signupSessionId);

  return {
    accounts: connectedAccounts.filter(Boolean),
    connected_count: connectedAccounts.length - skipped.length,
    skipped,
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

async function deactivateAccount(userId, accountId) {
  const account = await WaAccount.findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  const wasActive = account.status === 'active';
  await account.update({ status: 'inactive' });

  if (wasActive) {
    await adjustWhatsAppNumberUsage(userId, -1);
  }

  return account.toSafeJSON();
}

async function getPhoneNumbers(userId, accountId) {
  const account = await WaAccount.scope('withToken').findOne({
    where: { id: accountId, user_id: userId },
  });

  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }

  const decryptedToken = decrypt(account.access_token);

  try {
    const response = await axios.get(
      `${config.meta.baseUrl}/${account.waba_id}/phone_numbers`,
      {
        headers: buildMetaHeaders(decryptedToken),
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

  return decrypt(account.access_token);
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
    { quality_rating: qualityRating },
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
    { status },
    {
      where: { waba_id: String(wabaId) },
    }
  );
}

module.exports = {
  previewEmbeddedSignup,
  completeEmbeddedSignup,
  listAccounts,
  getAccount,
  deactivateAccount,
  getPhoneNumbers,
  getDecryptedToken,
  findByPhoneNumberId,
  updateQualityRating,
  updateAccountStatusByWaba,
};
