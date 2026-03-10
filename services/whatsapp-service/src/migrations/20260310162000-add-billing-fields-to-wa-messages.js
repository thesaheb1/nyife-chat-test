'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wa_messages', 'pricing_billable', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      after: 'pricing_category',
    });

    await queryInterface.addColumn('wa_messages', 'billing_category_estimated', {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: 'pricing_billable',
    });

    await queryInterface.addColumn('wa_messages', 'billing_category_actual', {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: 'billing_category_estimated',
    });

    await queryInterface.addColumn('wa_messages', 'billing_amount_estimated', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: 'billing_category_actual',
    });

    await queryInterface.addColumn('wa_messages', 'billing_amount_actual', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'billing_amount_estimated',
    });

    await queryInterface.addColumn('wa_messages', 'billing_status', {
      type: Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
      after: 'billing_amount_actual',
    });

    await queryInterface.addColumn('wa_messages', 'wallet_debit_transaction_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'billing_status',
    });

    await queryInterface.addColumn('wa_messages', 'wallet_adjustment_transaction_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'wallet_debit_transaction_id',
    });

    await queryInterface.addColumn('wa_messages', 'usage_applied_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'wallet_adjustment_transaction_id',
    });

    await queryInterface.addColumn('wa_messages', 'billing_reconciled_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'usage_applied_at',
    });

    await queryInterface.addIndex('wa_messages', ['billing_status'], {
      name: 'idx_wa_messages_billing_status',
    });

    await queryInterface.addIndex('wa_messages', ['usage_applied_at'], {
      name: 'idx_wa_messages_usage_applied_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('wa_messages', 'idx_wa_messages_usage_applied_at');
    await queryInterface.removeIndex('wa_messages', 'idx_wa_messages_billing_status');
    await queryInterface.removeColumn('wa_messages', 'billing_reconciled_at');
    await queryInterface.removeColumn('wa_messages', 'usage_applied_at');
    await queryInterface.removeColumn('wa_messages', 'wallet_adjustment_transaction_id');
    await queryInterface.removeColumn('wa_messages', 'wallet_debit_transaction_id');
    await queryInterface.removeColumn('wa_messages', 'billing_status');
    await queryInterface.removeColumn('wa_messages', 'billing_amount_actual');
    await queryInterface.removeColumn('wa_messages', 'billing_amount_estimated');
    await queryInterface.removeColumn('wa_messages', 'billing_category_actual');
    await queryInterface.removeColumn('wa_messages', 'billing_category_estimated');
    await queryInterface.removeColumn('wa_messages', 'pricing_billable');
  },
};
