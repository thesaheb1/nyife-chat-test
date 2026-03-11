'use strict';

const crypto = require('crypto');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
}

async function tableExists(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT 1 AS present FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
    { replacements: [tableName] }
  );
  return rows.length > 0;
}

async function getDefaultOrganizationId(queryInterface, userId) {
  const [existingOrganizations] = await queryInterface.sequelize.query(
    `SELECT id
     FROM org_organizations
     WHERE user_id = ?
       AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    { replacements: [userId] }
  );

  if (existingOrganizations.length > 0) {
    return existingOrganizations[0].id;
  }

  const organizationId = crypto.randomUUID();
  const slug = `${slugify('default')}-${organizationId.slice(0, 8)}`;
  const now = new Date();

  await queryInterface.sequelize.query(
    `INSERT INTO org_organizations (id, user_id, name, slug, description, status, logo_url, created_at, updated_at)
     VALUES (?, ?, 'default', ?, 'default organization', 'active', NULL, ?, ?)`,
    {
      replacements: [organizationId, userId, slug, now, now],
    }
  );

  return organizationId;
}

async function ensureWalletForOrg(queryInterface, organizationId) {
  if (!(await tableExists(queryInterface, 'wallet_wallets'))) {
    return;
  }

  const [walletRows] = await queryInterface.sequelize.query(
    'SELECT id FROM wallet_wallets WHERE user_id = ? LIMIT 1',
    { replacements: [organizationId] }
  );

  if (walletRows.length > 0) {
    return;
  }

  const now = new Date();
  await queryInterface.sequelize.query(
    `INSERT INTO wallet_wallets (id, user_id, balance, currency, created_at, updated_at)
     VALUES (?, ?, 0, 'INR', ?, ?)`,
    {
      replacements: [crypto.randomUUID(), organizationId, now, now],
    }
  );
}

async function getWalletByScopeId(queryInterface, scopeId) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, user_id, balance, currency
     FROM wallet_wallets
     WHERE user_id = ?
     LIMIT 1`,
    { replacements: [scopeId] }
  );

  return rows[0] || null;
}

async function getWalletTransactionCount(queryInterface, walletId) {
  if (!(await tableExists(queryInterface, 'wallet_transactions'))) {
    return 0;
  }

  const [rows] = await queryInterface.sequelize.query(
    'SELECT COUNT(*) AS total FROM wallet_transactions WHERE wallet_id = ?',
    { replacements: [walletId] }
  );

  return Number(rows[0]?.total || 0);
}

async function migrateWalletToDefaultOrganization(queryInterface, legacyUserId, organizationId) {
  if (!(await tableExists(queryInterface, 'wallet_wallets'))) {
    return;
  }

  const [legacyWallet, organizationWallet] = await Promise.all([
    getWalletByScopeId(queryInterface, legacyUserId),
    getWalletByScopeId(queryInterface, organizationId),
  ]);

  if (!legacyWallet && !organizationWallet) {
    await ensureWalletForOrg(queryInterface, organizationId);
    return;
  }

  if (!legacyWallet) {
    return;
  }

  if (organizationWallet && organizationWallet.id !== legacyWallet.id) {
    const transactionCount = await getWalletTransactionCount(queryInterface, organizationWallet.id);
    const hasSafePlaceholderState = Number(organizationWallet.balance || 0) === 0 && transactionCount === 0;

    if (!hasSafePlaceholderState) {
      throw new Error(
        `Cannot migrate wallet for legacy user ${legacyUserId}: organization wallet ${organizationWallet.id} already has data.`
      );
    }

    await queryInterface.sequelize.query(
      'DELETE FROM wallet_wallets WHERE id = ?',
      { replacements: [organizationWallet.id] }
    );
  }

  await queryInterface.sequelize.query(
    'UPDATE wallet_wallets SET user_id = ? WHERE id = ?',
    { replacements: [organizationId, legacyWallet.id] }
  );
}

async function createMigratedOrganization(queryInterface, ownerUserId, label) {
  const orgId = crypto.randomUUID();
  const now = new Date();
  const slug = `${slugify(label)}-${orgId.slice(0, 8)}`;

  await queryInterface.sequelize.query(
    `INSERT INTO org_organizations (id, user_id, name, slug, description, status, logo_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
    {
      replacements: [
        orgId,
        ownerUserId,
        label,
        slug,
        `${label} organization`,
        now,
        now,
      ],
    }
  );

  await ensureWalletForOrg(queryInterface, orgId);
  return orgId;
}

async function reassignWabaBoundRows(queryInterface, legacyUserId, organizationId, wabaId, accountIds) {
  const tableUpdates = [
    {
      table: 'tmpl_templates',
      sql: 'UPDATE tmpl_templates SET user_id = ? WHERE user_id = ? AND waba_id = ?',
      params: [organizationId, legacyUserId, wabaId],
    },
    {
      table: 'tmpl_flows',
      sql: 'UPDATE tmpl_flows SET user_id = ? WHERE user_id = ? AND waba_id = ?',
      params: [organizationId, legacyUserId, wabaId],
    },
  ];

  for (const entry of tableUpdates) {
    if (!(await tableExists(queryInterface, entry.table))) {
      continue;
    }
    await queryInterface.sequelize.query(entry.sql, { replacements: entry.params });
  }

  if (accountIds.length === 0) {
    return;
  }

  const accountPlaceholders = accountIds.map(() => '?').join(',');
  const accountScopedUpdates = [
    {
      table: 'wa_messages',
      sql: `UPDATE wa_messages SET user_id = ? WHERE user_id = ? AND wa_account_id IN (${accountPlaceholders})`,
      params: [organizationId, legacyUserId, ...accountIds],
    },
    {
      table: 'wa_onboarding_attempts',
      sql: `UPDATE wa_onboarding_attempts SET user_id = ? WHERE user_id = ? AND wa_account_id IN (${accountPlaceholders})`,
      params: [organizationId, legacyUserId, ...accountIds],
    },
    {
      table: 'chat_conversations',
      sql: `UPDATE chat_conversations SET user_id = ? WHERE user_id = ? AND wa_account_id IN (${accountPlaceholders})`,
      params: [organizationId, legacyUserId, ...accountIds],
    },
    {
      table: 'camp_campaigns',
      sql: `UPDATE camp_campaigns SET user_id = ? WHERE user_id = ? AND wa_account_id IN (${accountPlaceholders})`,
      params: [organizationId, legacyUserId, ...accountIds],
    },
    {
      table: 'tmpl_flow_submissions',
      sql: `UPDATE tmpl_flow_submissions SET user_id = ? WHERE user_id = ? AND wa_account_id IN (${accountPlaceholders})`,
      params: [organizationId, legacyUserId, ...accountIds],
    },
  ];

  for (const entry of accountScopedUpdates) {
    if (!(await tableExists(queryInterface, entry.table))) {
      continue;
    }
    await queryInterface.sequelize.query(entry.sql, { replacements: entry.params });
  }
}

module.exports = {
  async up(queryInterface) {
    const [users] = await queryInterface.sequelize.query(
      `SELECT id, email, role
       FROM auth_users
       WHERE deleted_at IS NULL
         AND role IN ('user')`
    );

    const defaultOrgByUser = new Map();

    for (const user of users) {
      const defaultOrgId = await getDefaultOrganizationId(queryInterface, user.id);
      defaultOrgByUser.set(user.id, defaultOrgId);
      await migrateWalletToDefaultOrganization(queryInterface, user.id, defaultOrgId);
    }

    if (await tableExists(queryInterface, 'wa_accounts')) {
      for (const user of users) {
        const [wabaRows] = await queryInterface.sequelize.query(
          `SELECT waba_id, MAX(updated_at) AS latest_updated_at
           FROM wa_accounts
           WHERE user_id = ?
             AND deleted_at IS NULL
           GROUP BY waba_id
           ORDER BY latest_updated_at DESC`,
          { replacements: [user.id] }
        );

        if (wabaRows.length <= 1) {
          continue;
        }

        let isPrimary = true;
        for (const wabaRow of wabaRows) {
          const targetOrganizationId = isPrimary
            ? defaultOrgByUser.get(user.id)
            : await createMigratedOrganization(
              queryInterface,
              user.id,
              `Migrated ${String(wabaRow.waba_id).slice(-6)}`
            );

          const [accountRows] = await queryInterface.sequelize.query(
            `SELECT id
             FROM wa_accounts
             WHERE user_id = ?
               AND waba_id = ?`,
            { replacements: [user.id, wabaRow.waba_id] }
          );
          const accountIds = accountRows.map((row) => row.id);

          await queryInterface.sequelize.query(
            'UPDATE wa_accounts SET user_id = ? WHERE user_id = ? AND waba_id = ?',
            { replacements: [targetOrganizationId, user.id, wabaRow.waba_id] }
          );

          await reassignWabaBoundRows(queryInterface, user.id, targetOrganizationId, wabaRow.waba_id, accountIds);
          isPrimary = false;
        }
      }
    }

    const defaultScopedTables = [
      'contact_contacts',
      'contact_tags',
      'contact_groups',
      'auto_automations',
      'auto_automation_logs',
      'auto_webhooks',
      'chat_messages',
      'wallet_transactions',
      'wallet_invoices',
      'sub_subscriptions',
      'support_tickets',
      'support_ticket_replies',
      'media_files',
      'analytics_daily_stats',
      'notif_notifications',
    ];

    for (const tableName of defaultScopedTables) {
      if (!(await tableExists(queryInterface, tableName))) {
        continue;
      }

      for (const user of users) {
        await queryInterface.sequelize.query(
          `UPDATE ${tableName}
           SET user_id = ?
           WHERE user_id = ?`,
          { replacements: [defaultOrgByUser.get(user.id), user.id] }
        );
      }
    }
  },

  async down() {
    // Data backfill is irreversible.
  },
};
