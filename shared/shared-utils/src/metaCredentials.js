'use strict';

const { decrypt } = require('./encryption');

const META_CREDENTIAL_SOURCES = {
  PROVIDER_SYSTEM_USER: 'provider_system_user',
  LEGACY_EMBEDDED_USER_TOKEN: 'legacy_embedded_user_token',
};

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }

  return false;
}

function allowLegacyMetaAccountTokenFallback(options = {}) {
  return normalizeBoolean(options.allowLegacyAccountTokenFallback);
}

function resolveMetaAccessCredential(options = {}) {
  const {
    systemUserAccessToken = null,
    encryptedAccessToken = null,
    allowLegacyAccountTokenFallback = false,
  } = options;

  if (systemUserAccessToken) {
    return {
      accessToken: systemUserAccessToken,
      source: META_CREDENTIAL_SOURCES.PROVIDER_SYSTEM_USER,
    };
  }

  if (!allowLegacyMetaAccountTokenFallback({ allowLegacyAccountTokenFallback }) || !encryptedAccessToken) {
    return null;
  }

  return {
    accessToken: decrypt(encryptedAccessToken),
    source: META_CREDENTIAL_SOURCES.LEGACY_EMBEDDED_USER_TOKEN,
  };
}

module.exports = {
  META_CREDENTIAL_SOURCES,
  allowLegacyMetaAccountTokenFallback,
  resolveMetaAccessCredential,
};
