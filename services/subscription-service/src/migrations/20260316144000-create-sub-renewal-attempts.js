'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sub_subscription_renewal_attempts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sub_subscriptions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      cycle_anchor_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      attempt_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      idempotency_key: {
        type: Sequelize.STRING(191),
        allowNull: false,
        unique: true,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      payment_method: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      transaction_reference_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex(
      'sub_subscription_renewal_attempts',
      ['subscription_id', 'cycle_anchor_at', 'attempt_number'],
      { name: 'idx_sub_renewal_attempts_cycle_attempt' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sub_subscription_renewal_attempts');
  },
};
