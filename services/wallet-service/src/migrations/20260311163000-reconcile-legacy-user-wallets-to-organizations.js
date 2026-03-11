'use strict';

const crypto = require('crypto');

async function tableExists(queryInterface, tableName, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 AS present
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    {
      replacements: [tableName],
      transaction,
    }
  );

  return rows.length > 0;
}

async function getDefaultOrganizationId(queryInterface, userId, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id
     FROM org_organizations
     WHERE user_id = ?
       AND deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`,
    {
      replacements: [userId],
      transaction,
    }
  );

  return rows[0]?.id || null;
}

function sortTransactions(a, b) {
  const createdAtDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return String(a.id).localeCompare(String(b.id));
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const requiredTables = ['auth_users', 'org_organizations', 'wallet_wallets'];
      for (const tableName of requiredTables) {
        if (!(await tableExists(queryInterface, tableName, transaction))) {
          return;
        }
      }

      const hasTransactionsTable = await tableExists(queryInterface, 'wallet_transactions', transaction);
      const hasInvoicesTable = await tableExists(queryInterface, 'wallet_invoices', transaction);

      const [legacyWallets] = await queryInterface.sequelize.query(
        `SELECT w.id, w.user_id, w.balance, w.currency, w.created_at, w.updated_at
         FROM wallet_wallets w
         INNER JOIN auth_users u
           ON u.id = w.user_id
          AND u.role = 'user'
         WHERE u.deleted_at IS NULL`,
        { transaction }
      );

      for (const legacyWallet of legacyWallets) {
        const organizationId = await getDefaultOrganizationId(queryInterface, legacyWallet.user_id, transaction);
        if (!organizationId) {
          continue;
        }

        const [organizationWalletRows] = await queryInterface.sequelize.query(
          `SELECT id, balance, currency
           FROM wallet_wallets
           WHERE user_id = ?
           LIMIT 1`,
          {
            replacements: [organizationId],
            transaction,
          }
        );

        let organizationWallet = organizationWalletRows[0] || null;
        if (!organizationWallet) {
          await queryInterface.sequelize.query(
            `INSERT INTO wallet_wallets (id, user_id, balance, currency, created_at, updated_at)
             VALUES (?, ?, 0, ?, NOW(), NOW())`,
            {
              replacements: [
                crypto.randomUUID(),
                organizationId,
                legacyWallet.currency || 'INR',
              ],
              transaction,
            }
          );

          const [freshWalletRows] = await queryInterface.sequelize.query(
            `SELECT id, balance, currency
             FROM wallet_wallets
             WHERE user_id = ?
             LIMIT 1`,
            {
              replacements: [organizationId],
              transaction,
            }
          );

          organizationWallet = freshWalletRows[0];
        }

        if (organizationWallet.id === legacyWallet.id) {
          continue;
        }

        let combinedTransactions = [];

        if (hasTransactionsTable) {
          const [sourceTransactions] = await queryInterface.sequelize.query(
            `SELECT id, type, amount, created_at
             FROM wallet_transactions
             WHERE wallet_id = ?
             ORDER BY created_at ASC, id ASC`,
            {
              replacements: [legacyWallet.id],
              transaction,
            }
          );

          if (sourceTransactions.length > 0) {
            await queryInterface.sequelize.query(
              `UPDATE wallet_transactions
               SET user_id = ?, wallet_id = ?
               WHERE wallet_id = ?`,
              {
                replacements: [organizationId, organizationWallet.id, legacyWallet.id],
                transaction,
              }
            );
          } else if (Number(legacyWallet.balance || 0) !== 0) {
            const amount = Math.abs(Number(legacyWallet.balance || 0));
            const type = Number(legacyWallet.balance || 0) >= 0 ? 'credit' : 'debit';
            const source = type === 'credit' ? 'admin_credit' : 'admin_debit';

            await queryInterface.sequelize.query(
              `INSERT INTO wallet_transactions (
                 id, user_id, wallet_id, type, amount, balance_after, source,
                 reference_type, reference_id, description, remarks, payment_status,
                 meta, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'completed', ?, NOW(), NOW())`,
              {
                replacements: [
                  crypto.randomUUID(),
                  organizationId,
                  organizationWallet.id,
                  type,
                  amount,
                  source,
                  'wallet_scope_reconciliation',
                  legacyWallet.id,
                  'Wallet balance migrated from legacy user scope',
                  null,
                  JSON.stringify({
                    legacyWalletId: legacyWallet.id,
                    legacyUserId: legacyWallet.user_id,
                  }),
                ],
                transaction,
              }
            );
          }

          const [targetTransactions] = await queryInterface.sequelize.query(
            `SELECT id, type, amount, created_at
             FROM wallet_transactions
             WHERE wallet_id = ?
             ORDER BY created_at ASC, id ASC`,
            {
              replacements: [organizationWallet.id],
              transaction,
            }
          );

          combinedTransactions = targetTransactions.slice().sort(sortTransactions);

          let runningBalance = 0;
          for (const walletTransaction of combinedTransactions) {
            const delta = walletTransaction.type === 'credit'
              ? Number(walletTransaction.amount || 0)
              : -Number(walletTransaction.amount || 0);
            runningBalance += delta;

            await queryInterface.sequelize.query(
              `UPDATE wallet_transactions
               SET balance_after = ?
               WHERE id = ?`,
              {
                replacements: [runningBalance, walletTransaction.id],
                transaction,
              }
            );
          }

          await queryInterface.sequelize.query(
            `UPDATE wallet_wallets
             SET balance = ?, updated_at = NOW()
             WHERE id = ?`,
            {
              replacements: [runningBalance, organizationWallet.id],
              transaction,
            }
          );
        } else {
          await queryInterface.sequelize.query(
            `UPDATE wallet_wallets
             SET balance = balance + ?, updated_at = NOW()
             WHERE id = ?`,
            {
              replacements: [legacyWallet.balance || 0, organizationWallet.id],
              transaction,
            }
          );
        }

        if (hasInvoicesTable) {
          await queryInterface.sequelize.query(
            `UPDATE wallet_invoices
             SET user_id = ?
             WHERE user_id = ?`,
            {
              replacements: [organizationId, legacyWallet.user_id],
              transaction,
            }
          );
        }

        await queryInterface.sequelize.query(
          'DELETE FROM wallet_wallets WHERE id = ?',
          {
            replacements: [legacyWallet.id],
            transaction,
          }
        );
      }
    });
  },

  async down() {
    // Irreversible data reconciliation.
  },
};
