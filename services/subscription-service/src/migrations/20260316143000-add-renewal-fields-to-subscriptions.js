'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sub_subscriptions', 'payment_method', {
      type: Sequelize.STRING(32),
      allowNull: true,
      after: 'payment_id',
    });

    await queryInterface.addColumn('sub_subscriptions', 'renewal_state', {
      type: Sequelize.STRING(32),
      allowNull: true,
      after: 'auto_renew',
    });

    await queryInterface.addColumn('sub_subscriptions', 'grace_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'renewal_state',
    });

    await queryInterface.addColumn('sub_subscriptions', 'next_renewal_attempt_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'grace_expires_at',
    });

    await queryInterface.addColumn('sub_subscriptions', 'renewal_attempt_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: 'next_renewal_attempt_at',
    });

    await queryInterface.addColumn('sub_subscriptions', 'last_renewal_error', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'renewal_attempt_count',
    });

    await queryInterface.addColumn('sub_subscriptions', 'replaces_subscription_id', {
      type: Sequelize.UUID,
      allowNull: true,
      after: 'last_renewal_error',
      references: { model: 'sub_subscriptions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.changeColumn('sub_subscriptions', 'auto_renew', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addIndex(
      'sub_subscriptions',
      ['status', 'auto_renew', 'expires_at'],
      { name: 'idx_sub_subscriptions_status_auto_renew_expires_at' }
    );

    await queryInterface.addIndex(
      'sub_subscriptions',
      ['next_renewal_attempt_at'],
      { name: 'idx_sub_subscriptions_next_renewal_attempt_at' }
    );

    await queryInterface.sequelize.query(`
      UPDATE sub_subscriptions
      SET auto_renew = FALSE,
          payment_method = CASE
            WHEN payment_id = 'free' OR amount_paid = 0 THEN 'free'
            WHEN payment_id IS NOT NULL AND payment_id <> '' THEN 'razorpay'
            ELSE payment_method
          END,
          renewal_attempt_count = 0
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'sub_subscriptions',
      'idx_sub_subscriptions_next_renewal_attempt_at'
    );
    await queryInterface.removeIndex(
      'sub_subscriptions',
      'idx_sub_subscriptions_status_auto_renew_expires_at'
    );

    await queryInterface.changeColumn('sub_subscriptions', 'auto_renew', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.removeColumn('sub_subscriptions', 'replaces_subscription_id');
    await queryInterface.removeColumn('sub_subscriptions', 'last_renewal_error');
    await queryInterface.removeColumn('sub_subscriptions', 'renewal_attempt_count');
    await queryInterface.removeColumn('sub_subscriptions', 'next_renewal_attempt_at');
    await queryInterface.removeColumn('sub_subscriptions', 'grace_expires_at');
    await queryInterface.removeColumn('sub_subscriptions', 'renewal_state');
    await queryInterface.removeColumn('sub_subscriptions', 'payment_method');
  },
};
