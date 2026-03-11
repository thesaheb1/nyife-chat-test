'use strict';

async function constraintExists(queryInterface, tableName, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 AS present
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
     LIMIT 1`,
    {
      replacements: [tableName, constraintName],
    }
  );

  return rows.length > 0;
}

async function removeConstraintIfExists(queryInterface, tableName, constraintName) {
  if (!(await constraintExists(queryInterface, tableName, constraintName))) {
    return;
  }

  await queryInterface.removeConstraint(tableName, constraintName);
}

module.exports = {
  async up(queryInterface) {
    await removeConstraintIfExists(queryInterface, 'wallet_wallets', 'wallet_wallets_ibfk_1');
    await removeConstraintIfExists(queryInterface, 'wallet_transactions', 'wallet_transactions_ibfk_1');
    await removeConstraintIfExists(queryInterface, 'wallet_invoices', 'wallet_invoices_ibfk_1');
    await removeConstraintIfExists(queryInterface, 'sub_subscriptions', 'sub_subscriptions_ibfk_1');
  },

  async down() {
    // Irreversible in a mixed user/org-scoped environment.
  },
};
