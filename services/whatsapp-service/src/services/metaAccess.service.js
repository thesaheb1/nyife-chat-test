'use strict';

const { AppError, resolveMetaAccessCredential } = require('@nyife/shared-utils');
const config = require('../config');

function getResolvedMetaCredential(account, options = {}) {
  const credential = resolveMetaAccessCredential({
    systemUserAccessToken: config.meta.systemUserAccessToken,
    encryptedAccessToken: account?.access_token || null,
    allowLegacyAccountTokenFallback:
      options.allowLegacyAccountTokenFallback ?? config.meta.allowLegacyAccountTokenFallback,
  });

  if (!credential) {
    return null;
  }

  return credential;
}

function requireResolvedMetaCredential(account, options = {}) {
  const credential = getResolvedMetaCredential(account, options);
  if (!credential) {
    throw new AppError(
      'No Meta credential is available for this WhatsApp account. Reconnect the account with Embedded Signup or configure a provider system-user token.',
      503
    );
  }

  return credential;
}

function hasProviderManagementConfig() {
  return Boolean(
    config.meta.systemUserAccessToken
    && config.meta.systemUserId
    && config.meta.providerBusinessId
  );
}

module.exports = {
  getResolvedMetaCredential,
  requireResolvedMetaCredential,
  hasProviderManagementConfig,
};
