'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { WaAccount } = require('../models');
const { AppError, encrypt, decrypt } = require('@nyife/shared-utils');
const config = require('../config');

/**
 * Handles the embedded signup flow.
 * 1. Exchange code for access token via Meta OAuth
 * 2. Debug token to find business_id
 * 3. Get shared WABAs
 * 4. Get phone numbers for each WABA
 * 5. Subscribe app to WABA
 * 6. Encrypt access token and store wa_accounts record
 * 7. Check subscription limit for whatsapp_numbers
 *
 * @param {string} userId - The tenant user ID
 * @param {string} code - The authorization code from Meta Embedded Signup SDK
 * @returns {Promise<object>} The created WaAccount record (safe JSON)
 */
async function handleEmbeddedSignup(userId, code) {
  // Step 1: Exchange code for access token
  let accessToken;
  try {
    const tokenResponse = await axios.get(
      `https://graph.facebook.com/${config.meta.apiVersion}/oauth/access_token`,
      {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          code,
        },
      }
    );
    accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error('No access_token returned from Meta OAuth');
    }
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      const metaError = err.response.data.error;
      throw AppError.badRequest(
        `Meta OAuth error: ${metaError.message || 'Failed to exchange code'}`
      );
    }
    throw AppError.badRequest('Failed to exchange authorization code for access token');
  }

  // Step 2: Debug token to find business_id and WABA info
  let debugData;
  try {
    const debugResponse = await axios.get(
      `https://graph.facebook.com/${config.meta.apiVersion}/debug_token`,
      {
        params: { input_token: accessToken },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    debugData = debugResponse.data.data;
  } catch (err) {
    throw AppError.badRequest('Failed to debug access token with Meta API');
  }

  const businessId =
    debugData.granular_scopes?.find((s) => s.scope === 'whatsapp_business_management')
      ?.target_ids?.[0] || debugData.profile_id || null;

  // Step 3: Get shared WABAs
  // The WABA ID may be in the debug token data or we need to fetch from business
  let wabaId;
  let wabaData;

  // Try to get WABA from granular_scopes in debug token
  const whatsappScope = debugData.granular_scopes?.find(
    (s) => s.scope === 'whatsapp_business_messaging'
  );
  if (whatsappScope && whatsappScope.target_ids && whatsappScope.target_ids.length > 0) {
    wabaId = whatsappScope.target_ids[0];
  }

  // If not found in scopes, try to get from business client_whatsapp_business_accounts
  if (!wabaId && businessId) {
    try {
      const wabaResponse = await axios.get(
        `${config.meta.baseUrl}/${businessId}/client_whatsapp_business_accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const wabaList = wabaResponse.data.data;
      if (wabaList && wabaList.length > 0) {
        wabaId = wabaList[0].id;
        wabaData = wabaList[0];
      }
    } catch (err) {
      // Try owned_whatsapp_business_accounts as fallback
      try {
        const ownedResponse = await axios.get(
          `${config.meta.baseUrl}/${businessId}/owned_whatsapp_business_accounts`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const ownedList = ownedResponse.data.data;
        if (ownedList && ownedList.length > 0) {
          wabaId = ownedList[0].id;
          wabaData = ownedList[0];
        }
      } catch (innerErr) {
        throw AppError.badRequest('Could not retrieve WhatsApp Business accounts from Meta');
      }
    }
  }

  if (!wabaId) {
    throw AppError.badRequest(
      'No WhatsApp Business Account found. Please ensure you shared your WABA during signup.'
    );
  }

  // Step 4: Get phone numbers for the WABA
  let phoneNumbers;
  try {
    const phoneResponse = await axios.get(
      `${config.meta.baseUrl}/${wabaId}/phone_numbers`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    phoneNumbers = phoneResponse.data.data;
  } catch (err) {
    throw AppError.badRequest('Failed to retrieve phone numbers from Meta API');
  }

  if (!phoneNumbers || phoneNumbers.length === 0) {
    throw AppError.badRequest(
      'No phone numbers found for this WhatsApp Business Account'
    );
  }

  // Step 5: Subscribe app to WABA
  try {
    await axios.post(
      `${config.meta.baseUrl}/${wabaId}/subscribed_apps`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch (err) {
    // Log but do not fail — subscription may already exist
    console.warn(
      '[whatsapp-service] Could not subscribe app to WABA:',
      err.response?.data?.error?.message || err.message
    );
  }

  // Step 6: Check subscription limit for whatsapp_numbers (best-effort)
  try {
    await axios.post(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/limits/check`,
      {
        user_id: userId,
        resource: 'whatsapp_numbers',
        increment: phoneNumbers.length,
      },
      {
        headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    if (err.response && err.response.status === 403) {
      throw AppError.forbidden(
        err.response.data?.message ||
          'WhatsApp number limit reached for your subscription plan. Please upgrade.'
      );
    }
    // Log and continue for other errors (subscription service may be down)
    console.warn(
      '[whatsapp-service] Could not check subscription limit:',
      err.message
    );
  }

  // Step 7: Encrypt access token and create wa_accounts records
  const encryptedToken = encrypt(accessToken);
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  const createdAccounts = [];

  for (const phone of phoneNumbers) {
    // Check if account already exists for this user + phone_number_id
    const existing = await WaAccount.unscoped().findOne({
      where: {
        user_id: userId,
        phone_number_id: String(phone.id),
      },
    });

    if (existing) {
      // Update existing account with new token and info
      await existing.update({
        access_token: encryptedToken,
        waba_id: String(wabaId),
        display_phone: phone.display_phone_number || null,
        verified_name: phone.verified_name || wabaData?.name || null,
        business_id: businessId ? String(businessId) : null,
        quality_rating: phone.quality_rating || null,
        messaging_limit: phone.throughput?.level || null,
        platform_type: phone.platform_type || 'CLOUD_API',
        status: 'active',
        webhook_secret: existing.webhook_secret || webhookSecret,
        deleted_at: null, // Restore if soft-deleted
      });
      createdAccounts.push(existing.toSafeJSON());
    } else {
      const account = await WaAccount.create({
        user_id: userId,
        waba_id: String(wabaId),
        phone_number_id: String(phone.id),
        display_phone: phone.display_phone_number || null,
        verified_name: phone.verified_name || wabaData?.name || null,
        business_id: businessId ? String(businessId) : null,
        access_token: encryptedToken,
        quality_rating: phone.quality_rating || null,
        messaging_limit: phone.throughput?.level || null,
        platform_type: phone.platform_type || 'CLOUD_API',
        status: 'active',
        webhook_secret: webhookSecret,
      });
      createdAccounts.push(account.toSafeJSON());
    }
  }

  // Return the first account (primary) — most signups have a single phone
  return createdAccounts.length === 1 ? createdAccounts[0] : createdAccounts;
}

/**
 * Lists all WA accounts for a user (excluding access_token).
 *
 * @param {string} userId - The tenant user ID
 * @returns {Promise<Array>} List of WaAccount records
 */
async function listAccounts(userId) {
  const accounts = await WaAccount.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
  });
  return accounts.map((acct) => acct.toSafeJSON());
}

/**
 * Gets a single WA account by ID for a user (excluding access_token).
 *
 * @param {string} userId - The tenant user ID
 * @param {string} accountId - The WA account UUID
 * @returns {Promise<object>} WaAccount record
 */
async function getAccount(userId, accountId) {
  const account = await WaAccount.findOne({
    where: { id: accountId, user_id: userId },
  });
  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }
  return account.toSafeJSON();
}

/**
 * Deactivates a WA account (sets status to 'inactive').
 *
 * @param {string} userId - The tenant user ID
 * @param {string} accountId - The WA account UUID
 * @returns {Promise<object>} Updated WaAccount record
 */
async function deactivateAccount(userId, accountId) {
  const account = await WaAccount.findOne({
    where: { id: accountId, user_id: userId },
  });
  if (!account) {
    throw AppError.notFound('WhatsApp account not found');
  }
  await account.update({ status: 'inactive' });
  return account.toSafeJSON();
}

/**
 * Fetches phone numbers for a WA account from Meta API.
 *
 * @param {string} userId - The tenant user ID
 * @param {string} accountId - The WA account UUID
 * @returns {Promise<Array>} Phone numbers from Meta API
 */
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
        headers: { Authorization: `Bearer ${decryptedToken}` },
      }
    );
    return response.data.data || [];
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      throw AppError.badRequest(
        `Meta API error: ${err.response.data.error.message}`
      );
    }
    throw AppError.internal('Failed to fetch phone numbers from Meta API');
  }
}

/**
 * Internal: Decrypts and returns the access token for a WA account.
 * Used by message.service and webhook.service.
 *
 * @param {string} accountId - The WA account UUID
 * @returns {Promise<string>} Decrypted access token
 */
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

/**
 * Internal: Finds a WA account by phone_number_id (used by webhook processing).
 *
 * @param {string} phoneNumberId - The Meta phone_number_id
 * @returns {Promise<object|null>} WaAccount record or null
 */
async function findByPhoneNumberId(phoneNumberId) {
  const account = await WaAccount.findOne({
    where: {
      phone_number_id: String(phoneNumberId),
      status: 'active',
    },
  });
  return account;
}

/**
 * Internal: Updates the quality rating of a WA account's phone number.
 *
 * @param {string} phoneNumberId - The Meta phone_number_id
 * @param {string} qualityRating - The new quality rating (GREEN, YELLOW, RED)
 * @returns {Promise<void>}
 */
async function updateQualityRating(phoneNumberId, qualityRating) {
  await WaAccount.update(
    { quality_rating: qualityRating },
    {
      where: { phone_number_id: String(phoneNumberId) },
    }
  );
}

/**
 * Internal: Updates the status of a WA account by WABA ID.
 *
 * @param {string} wabaId - The Meta WABA ID
 * @param {string} status - The new status
 * @returns {Promise<void>}
 */
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
  handleEmbeddedSignup,
  listAccounts,
  getAccount,
  deactivateAccount,
  getPhoneNumbers,
  getDecryptedToken,
  findByPhoneNumberId,
  updateQualityRating,
  updateAccountStatusByWaba,
};
