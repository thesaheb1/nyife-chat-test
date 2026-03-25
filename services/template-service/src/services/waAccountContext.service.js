'use strict';

const { QueryTypes } = require('sequelize');
const { AppError } = require('@nyife/shared-utils');
const { sequelize } = require('../models');

const ACTIVE_ACCOUNT_COLUMNS = `
  SELECT id, user_id, waba_id, phone_number_id, access_token, status, onboarding_status, display_phone, verified_name, updated_at, created_at
  FROM wa_accounts
`;

function normalizeWabaId(value) {
  return value ? String(value) : null;
}

function buildMultipleWabaError() {
  return AppError.badRequest(
    'Multiple WhatsApp Business Accounts are connected for this organization. Nyife now auto-selects a single WABA for templates and flows, so disconnect extra WABAs before continuing.'
  );
}

async function listActiveWaAccounts(userId) {
  return sequelize.query(
    `${ACTIVE_ACCOUNT_COLUMNS}
     WHERE user_id = :userId
       AND status = :status
       AND deleted_at IS NULL
     ORDER BY updated_at DESC, created_at DESC`,
    {
      replacements: {
        userId,
        status: 'active',
      },
      type: QueryTypes.SELECT,
    }
  );
}

async function fetchActiveWaAccountById(userId, waAccountId) {
  if (!waAccountId) {
    return null;
  }

  const accounts = await sequelize.query(
    `${ACTIVE_ACCOUNT_COLUMNS}
     WHERE id = :waAccountId
       AND user_id = :userId
       AND status = :status
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: {
        waAccountId,
        userId,
        status: 'active',
      },
      type: QueryTypes.SELECT,
    }
  );

  return accounts[0] || null;
}

async function fetchLatestActiveWaAccountByWaba(userId, wabaId) {
  const normalizedWabaId = normalizeWabaId(wabaId);
  if (!normalizedWabaId) {
    return null;
  }

  const accounts = await sequelize.query(
    `${ACTIVE_ACCOUNT_COLUMNS}
     WHERE user_id = :userId
       AND waba_id = :wabaId
       AND status = :status
       AND deleted_at IS NULL
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    {
      replacements: {
        userId,
        wabaId: normalizedWabaId,
        status: 'active',
      },
      type: QueryTypes.SELECT,
    }
  );

  return accounts[0] || null;
}

async function resolveSingleWabaAccount(userId, options = {}) {
  const {
    waAccountId = null,
    wabaId = null,
    allowFallbackByWaba = true,
    allowAutoResolve = true,
  } = options;

  const normalizedWabaId = normalizeWabaId(wabaId);

  if (waAccountId) {
    const account = await fetchActiveWaAccountById(userId, waAccountId);
    if (!account) {
      throw AppError.badRequest('Select an active WhatsApp phone number for this organization.');
    }

    if (normalizedWabaId && normalizeWabaId(account.waba_id) !== normalizedWabaId) {
      throw AppError.badRequest(
        `The selected WhatsApp phone number belongs to WABA ${account.waba_id}, but WABA ${normalizedWabaId} was requested.`
      );
    }

    return {
      account,
      wa_account_id: account.id,
      waba_id: normalizeWabaId(account.waba_id),
      active_accounts: [account],
      waba_accounts: [account],
    };
  }

  if (allowFallbackByWaba && normalizedWabaId) {
    const account = await fetchLatestActiveWaAccountByWaba(userId, normalizedWabaId);
    if (account) {
      return {
        account,
        wa_account_id: account.id,
        waba_id: normalizeWabaId(account.waba_id),
        active_accounts: [account],
        waba_accounts: [account],
      };
    }

    if (!allowAutoResolve) {
      return {
        account: null,
        wa_account_id: null,
        waba_id: normalizedWabaId,
        active_accounts: [],
        waba_accounts: [],
      };
    }
  }

  if (!allowAutoResolve) {
    return {
      account: null,
      wa_account_id: null,
      waba_id: normalizedWabaId,
      active_accounts: [],
      waba_accounts: [],
    };
  }

  const activeAccounts = await listActiveWaAccounts(userId);
  const resolvedWabaIdSet = [...new Set(activeAccounts.map((account) => normalizeWabaId(account.waba_id)).filter(Boolean))];

  if (normalizedWabaId) {
    const matchingAccounts = activeAccounts.filter(
      (account) => normalizeWabaId(account.waba_id) === normalizedWabaId
    );

    return {
      account: matchingAccounts[0] || null,
      wa_account_id: matchingAccounts[0]?.id || null,
      waba_id: normalizedWabaId,
      active_accounts: activeAccounts,
      waba_accounts: matchingAccounts,
    };
  }

  if (resolvedWabaIdSet.length > 1) {
    throw buildMultipleWabaError();
  }

  const resolvedWabaId = resolvedWabaIdSet[0] || null;
  const wabaAccounts = resolvedWabaId
    ? activeAccounts.filter((account) => normalizeWabaId(account.waba_id) === resolvedWabaId)
    : activeAccounts;
  const account = wabaAccounts[0] || null;

  return {
    account,
    wa_account_id: account?.id || null,
    waba_id: resolvedWabaId,
    active_accounts: activeAccounts,
    waba_accounts: wabaAccounts,
  };
}

module.exports = {
  listActiveWaAccounts,
  fetchActiveWaAccountById,
  fetchLatestActiveWaAccountByWaba,
  resolveSingleWabaAccount,
};
