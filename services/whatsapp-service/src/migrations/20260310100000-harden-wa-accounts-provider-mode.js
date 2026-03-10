'use strict';

const TABLE_NAME = 'wa_accounts';

async function addColumnIfMissing(queryInterface, Sequelize, table, columnName, definition) {
  const tableDescription = await queryInterface.describeTable(table);
  if (!tableDescription[columnName]) {
    await queryInterface.addColumn(table, columnName, definition);
  }
}

async function addIndexIfMissing(queryInterface, table, fields, name) {
  const indexes = await queryInterface.showIndex(table);
  if (!indexes.some((index) => index.name === name)) {
    await queryInterface.addIndex(table, fields, { name });
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(TABLE_NAME);

    if (table.access_token && table.access_token.allowNull === false) {
      await queryInterface.changeColumn(TABLE_NAME, 'access_token', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'credential_source', {
      type: Sequelize.ENUM('provider_system_user', 'legacy_embedded_user_token'),
      allowNull: false,
      defaultValue: 'legacy_embedded_user_token',
      after: 'registration_pin',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'assigned_system_user_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'credential_source',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'app_subscription_status', {
      type: Sequelize.ENUM('unknown', 'subscribed', 'not_subscribed', 'failed'),
      allowNull: false,
      defaultValue: 'unknown',
      after: 'status',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'credit_sharing_status', {
      type: Sequelize.ENUM('unknown', 'not_required', 'attached', 'failed'),
      allowNull: false,
      defaultValue: 'unknown',
      after: 'app_subscription_status',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'onboarding_status', {
      type: Sequelize.ENUM('pending', 'in_progress', 'active', 'failed', 'needs_reconcile', 'inactive'),
      allowNull: false,
      defaultValue: 'needs_reconcile',
      after: 'credit_sharing_status',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'last_health_checked_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'onboarding_status',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'last_onboarded_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'last_health_checked_at',
    });

    await addColumnIfMissing(queryInterface, Sequelize, TABLE_NAME, 'last_onboarding_error', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'last_onboarded_at',
    });

    await queryInterface.sequelize.query(`
      UPDATE ${TABLE_NAME}
      SET credential_source = CASE
            WHEN access_token IS NULL OR access_token = '' THEN 'provider_system_user'
            ELSE 'legacy_embedded_user_token'
          END,
          onboarding_status = CASE
            WHEN status = 'inactive' THEN 'inactive'
            WHEN access_token IS NULL OR access_token = '' THEN 'needs_reconcile'
            ELSE 'needs_reconcile'
          END,
          app_subscription_status = COALESCE(app_subscription_status, 'unknown'),
          credit_sharing_status = COALESCE(credit_sharing_status, 'unknown')
    `);

    await addIndexIfMissing(queryInterface, TABLE_NAME, ['credential_source'], 'idx_wa_accounts_credential_source');
    await addIndexIfMissing(queryInterface, TABLE_NAME, ['onboarding_status'], 'idx_wa_accounts_onboarding_status');
    await addIndexIfMissing(queryInterface, TABLE_NAME, ['app_subscription_status'], 'idx_wa_accounts_app_subscription_status');
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(TABLE_NAME);

    for (const indexName of [
      'idx_wa_accounts_credential_source',
      'idx_wa_accounts_onboarding_status',
      'idx_wa_accounts_app_subscription_status',
    ]) {
      const indexes = await queryInterface.showIndex(TABLE_NAME);
      if (indexes.some((index) => index.name === indexName)) {
        await queryInterface.removeIndex(TABLE_NAME, indexName);
      }
    }

    for (const columnName of [
      'last_onboarding_error',
      'last_onboarded_at',
      'last_health_checked_at',
      'onboarding_status',
      'credit_sharing_status',
      'app_subscription_status',
      'assigned_system_user_id',
      'credential_source',
    ]) {
      if (table[columnName]) {
        await queryInterface.removeColumn(TABLE_NAME, columnName);
      }
    }

    if (table.access_token) {
      await queryInterface.changeColumn(TABLE_NAME, 'access_token', {
        type: Sequelize.TEXT,
        allowNull: false,
      });
    }
  },
};
