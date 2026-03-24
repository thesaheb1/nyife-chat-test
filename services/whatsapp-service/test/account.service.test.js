'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.ENCRYPTION_IV = process.env.ENCRYPTION_IV || '0123456789abcdef0123456789abcdef';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const axios = require('axios');
const { encrypt } = require('@nyife/shared-utils');
const { WaAccount, WaOnboardingAttempt } = require('../src/models');
const config = require('../src/config');
const accountService = require('../src/services/account.service');

const { __private } = accountService;

const originalMetaConfig = {
  appId: config.meta.appId,
  baseUrl: config.meta.baseUrl,
  systemUserAccessToken: config.meta.systemUserAccessToken,
  systemUserId: config.meta.systemUserId,
  providerBusinessId: config.meta.providerBusinessId,
  enableCreditSharing: config.meta.enableCreditSharing,
};

function createMetaError(code, message) {
  const error = new Error(message);
  error.response = {
    data: {
      error: {
        code,
        message,
      },
    },
  };
  return error;
}

function createFakeAttempt() {
  return {
    async update() {},
  };
}

function createFakeAccount(overrides = {}) {
  const record = {
    id: overrides.id || 'account-1',
    user_id: overrides.user_id || 'user-1',
    waba_id: overrides.waba_id || 'waba-1',
    phone_number_id: overrides.phone_number_id || 'phone-1',
    display_phone: overrides.display_phone || '+1 415 555 2671',
    verified_name: overrides.verified_name || 'Nyife QA',
    business_id: overrides.business_id || 'business-1',
    access_token: overrides.access_token || null,
    registration_pin: overrides.registration_pin || null,
    credential_source: overrides.credential_source || 'legacy_embedded_user_token',
    assigned_system_user_id: overrides.assigned_system_user_id || null,
    quality_rating: overrides.quality_rating || 'GREEN',
    name_status: overrides.name_status || 'APPROVED',
    number_status: overrides.number_status || 'CONNECTED',
    code_verification_status: overrides.code_verification_status || null,
    account_review_status: overrides.account_review_status || 'APPROVED',
    messaging_limit: overrides.messaging_limit || 'TIER_1K',
    platform_type: overrides.platform_type || 'CLOUD_API',
    status: overrides.status || 'active',
    app_subscription_status: overrides.app_subscription_status || 'subscribed',
    credit_sharing_status: overrides.credit_sharing_status || 'unknown',
    onboarding_status: overrides.onboarding_status || 'active',
    last_health_checked_at: overrides.last_health_checked_at || null,
    last_onboarded_at: overrides.last_onboarded_at || null,
    last_onboarding_error: overrides.last_onboarding_error || null,
    webhook_secret: overrides.webhook_secret || 'secret',
    deleted_at: overrides.deleted_at || null,
    async update(payload) {
      Object.assign(this, payload);
      return this;
    },
    toSafeJSON() {
      return {
        id: this.id,
        user_id: this.user_id,
        waba_id: this.waba_id,
        phone_number_id: this.phone_number_id,
        display_phone: this.display_phone,
        verified_name: this.verified_name,
        business_id: this.business_id,
        credential_source: this.credential_source,
        assigned_system_user_id: this.assigned_system_user_id,
        quality_rating: this.quality_rating,
        name_status: this.name_status,
        number_status: this.number_status,
        code_verification_status: this.code_verification_status,
        account_review_status: this.account_review_status,
        messaging_limit: this.messaging_limit,
        platform_type: this.platform_type,
        status: this.status,
        app_subscription_status: this.app_subscription_status,
        credit_sharing_status: this.credit_sharing_status,
        onboarding_status: this.onboarding_status,
        last_health_checked_at: this.last_health_checked_at,
        last_onboarded_at: this.last_onboarded_at,
        last_onboarding_error: this.last_onboarding_error,
        created_at: this.created_at || null,
        updated_at: this.updated_at || null,
      };
    },
  };

  return record;
}

function resetMetaConfig() {
  config.meta.appId = originalMetaConfig.appId;
  config.meta.baseUrl = originalMetaConfig.baseUrl;
  config.meta.systemUserAccessToken = originalMetaConfig.systemUserAccessToken;
  config.meta.systemUserId = originalMetaConfig.systemUserId;
  config.meta.providerBusinessId = originalMetaConfig.providerBusinessId;
  config.meta.enableCreditSharing = originalMetaConfig.enableCreditSharing;
}

afterEach(() => {
  mock.restoreAll();
  resetMetaConfig();
});

describe('account.service legacy embedded signup compatibility', () => {
  it('skips Meta registration when the phone is already CONNECTED', async () => {
    const getMock = mock.method(axios, 'get', async () => ({
      data: {
        status: 'CONNECTED',
        display_phone_number: '+1 415 555 2671',
      },
    }));
    const postMock = mock.method(axios, 'post', async () => {
      throw new Error('register should not be called for CONNECTED numbers');
    });

    const result = await __private.ensurePhoneRegistrationForSignup('signup-token', {
      phone_number_id: 'phone-1',
      display_phone: '+1 415 555 2671',
    });

    assert.equal(result.skipped, true);
    assert.equal(result.statusBefore, 'CONNECTED');
    assert.equal(getMock.mock.calls.length, 1);
    assert.equal(postMock.mock.calls.length, 0);
  });

  it('registers non-CONNECTED numbers with the legacy pin and localization region via Graph v20.0', async () => {
    mock.method(axios, 'get', async () => ({
      data: {
        status: 'PENDING',
        display_phone_number: '+1 415 555 2671',
      },
    }));
    const postMock = mock.method(axios, 'post', async () => ({
      data: { success: true },
    }));

    const result = await __private.ensurePhoneRegistrationForSignup('signup-token', {
      phone_number_id: 'phone-1',
      display_phone: '+1 415 555 2671',
    });

    assert.equal(result.skipped, false);
    assert.equal(postMock.mock.calls.length, 1);

    const [url, payload, options] = postMock.mock.calls[0].arguments;
    assert.equal(url, 'https://graph.facebook.com/v20.0/phone-1/register');
    assert.deepEqual(payload, {
      messaging_product: 'whatsapp',
      pin: '123456',
      data_localization_region: 'US',
    });
    assert.equal(options.headers.Authorization, 'Bearer signup-token');
  });

  it('fails signup on Meta 133005 without silently rewriting the Meta two-step pin', async () => {
    mock.method(axios, 'get', async () => ({
      data: {
        status: 'PENDING',
        display_phone_number: '+1 415 555 2671',
      },
    }));
    const postMock = mock.method(axios, 'post', async () => {
      throw createMetaError('133005', 'Wrong PIN used.');
    });

    await assert.rejects(
      () =>
        __private.ensurePhoneRegistrationForSignup('signup-token', {
          phone_number_id: 'phone-1',
          display_phone: '+1 415 555 2671',
        }),
      (error) => {
        assert.match(error.message, /Repair legacy signup compatibility/i);
        return true;
      }
    );

    assert.equal(postMock.mock.calls.length, 1);
    assert.equal(postMock.mock.calls[0].arguments[0], 'https://graph.facebook.com/v20.0/phone-1/register');
  });

  it('repairs legacy compatibility by resetting the shared pin and conditionally re-registering the phone', async () => {
    const getMock = mock.method(axios, 'get', async () => ({
      data: {
        status: 'PENDING',
        display_phone_number: '+1 415 555 2671',
      },
    }));
    const postMock = mock.method(axios, 'post', async () => ({
      data: { success: true },
    }));

    const result = await __private.repairLegacyRegistrationCompatibility('repair-token', {
      phone_number_id: 'phone-1',
      display_phone: '+1 415 555 2671',
    });

    assert.equal(result.pinReset, true);
    assert.equal(result.registered, true);
    assert.equal(result.statusBefore, 'PENDING');
    assert.equal(getMock.mock.calls.length, 1);
    assert.equal(postMock.mock.calls.length, 2);

    const [pinResetUrl, pinResetPayload, pinResetOptions] = postMock.mock.calls[0].arguments;
    assert.equal(pinResetUrl, `${config.meta.baseUrl}/phone-1`);
    assert.deepEqual(pinResetPayload, { pin: '123456' });
    assert.equal(pinResetOptions.headers.Authorization, 'Bearer repair-token');

    const [registerUrl, registerPayload, registerOptions] = postMock.mock.calls[1].arguments;
    assert.equal(registerUrl, 'https://graph.facebook.com/v20.0/phone-1/register');
    assert.deepEqual(registerPayload, {
      messaging_product: 'whatsapp',
      pin: '123456',
      data_localization_region: 'US',
    });
    assert.equal(registerOptions.headers.Authorization, 'Bearer repair-token');
  });

  it('uses the provider system-user token during explicit repair when provider credentials are configured', async () => {
    config.meta.appId = 'app-1';
    config.meta.systemUserAccessToken = 'provider-token';
    config.meta.systemUserId = 'system-user-1';
    config.meta.providerBusinessId = 'provider-business-1';
    config.meta.enableCreditSharing = false;

    const account = createFakeAccount({
      access_token: encrypt('legacy-token'),
      credential_source: 'legacy_embedded_user_token',
    });

    mock.method(WaAccount, 'scope', () => ({
      findOne: async () => account,
    }));
    mock.method(WaOnboardingAttempt, 'create', async () => createFakeAttempt());

    const observedAuthHeaders = [];
    mock.method(axios, 'get', async (url, options = {}) => {
      observedAuthHeaders.push(options.headers?.Authorization || null);

      if (url === `${config.meta.baseUrl}/${config.meta.providerBusinessId}/system_users`) {
        return { data: { data: [{ id: config.meta.systemUserId }] } };
      }

      if (url === `${config.meta.baseUrl}/${account.waba_id}/assigned_users`) {
        return { data: { data: [{ id: config.meta.systemUserId }] } };
      }

      if (url === `${config.meta.baseUrl}/${account.waba_id}/subscribed_apps`) {
        return { data: { data: [{ id: config.meta.appId }] } };
      }

      if (url === `${config.meta.baseUrl}/${account.phone_number_id}`) {
        return {
          data: {
            status: 'CONNECTED',
            display_phone_number: account.display_phone,
            verified_name: account.verified_name,
            quality_rating: account.quality_rating,
            name_status: account.name_status,
            code_verification_status: 'VERIFIED',
            messaging_limit_tier: account.messaging_limit,
          },
        };
      }

      if (url === `${config.meta.baseUrl}/${account.waba_id}`) {
        return { data: { account_review_status: 'APPROVED' } };
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    const postMock = mock.method(axios, 'post', async (_url, _payload, options = {}) => {
      observedAuthHeaders.push(options.headers?.Authorization || null);
      return { data: { success: true } };
    });

    const result = await accountService.reconcileAccount(account.user_id, account.id);

    assert.equal(result.account.credential_source, 'provider_system_user');
    assert.ok(result.steps.some((step) => step.name === 'repair_two_step_verification'));
    assert.equal(postMock.mock.calls.length, 1);
    assert.ok(observedAuthHeaders.every((header) => header === 'Bearer provider-token'));
  });

  it('falls back to the stored embedded-signup token during explicit repair when provider credentials are unavailable', async () => {
    config.meta.appId = 'app-1';
    config.meta.systemUserAccessToken = null;
    config.meta.systemUserId = null;
    config.meta.providerBusinessId = null;
    config.meta.enableCreditSharing = false;

    const account = createFakeAccount({
      access_token: encrypt('legacy-token'),
      credential_source: 'legacy_embedded_user_token',
    });

    mock.method(WaAccount, 'scope', () => ({
      findOne: async () => account,
    }));
    mock.method(WaOnboardingAttempt, 'create', async () => createFakeAttempt());

    const observedAuthHeaders = [];
    mock.method(axios, 'get', async (url, options = {}) => {
      observedAuthHeaders.push(options.headers?.Authorization || null);

      if (url === `${config.meta.baseUrl}/${account.waba_id}/subscribed_apps`) {
        return { data: { data: [{ id: config.meta.appId }] } };
      }

      if (url === `${config.meta.baseUrl}/${account.phone_number_id}`) {
        return {
          data: {
            status: 'CONNECTED',
            display_phone_number: account.display_phone,
            verified_name: account.verified_name,
            quality_rating: account.quality_rating,
            name_status: account.name_status,
            code_verification_status: 'VERIFIED',
            messaging_limit_tier: account.messaging_limit,
          },
        };
      }

      if (url === `${config.meta.baseUrl}/${account.waba_id}`) {
        return { data: { account_review_status: 'APPROVED' } };
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    const postMock = mock.method(axios, 'post', async (_url, _payload, options = {}) => {
      observedAuthHeaders.push(options.headers?.Authorization || null);
      return { data: { success: true } };
    });

    const result = await accountService.reconcileAccount(account.user_id, account.id);

    assert.equal(result.account.credential_source, 'legacy_embedded_user_token');
    assert.ok(result.steps.some((step) => step.name === 'assign_system_user' && step.status === 'skipped'));
    assert.equal(postMock.mock.calls.length, 1);
    assert.ok(observedAuthHeaders.every((header) => header === 'Bearer legacy-token'));
  });
});
