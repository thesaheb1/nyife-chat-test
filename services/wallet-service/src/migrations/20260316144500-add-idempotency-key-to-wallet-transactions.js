'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wallet_transactions', 'idempotency_key', {
      type: Sequelize.STRING(191),
      allowNull: true,
      after: 'payment_status',
    });

    await queryInterface.addIndex(
      'wallet_transactions',
      ['idempotency_key'],
      {
        name: 'idx_wallet_transactions_idempotency_key',
        unique: true,
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'wallet_transactions',
      'idx_wallet_transactions_idempotency_key'
    );
    await queryInterface.removeColumn('wallet_transactions', 'idempotency_key');
  },
};
