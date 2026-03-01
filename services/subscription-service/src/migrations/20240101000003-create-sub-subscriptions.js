'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sub_subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'auth_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'sub_plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('active', 'expired', 'cancelled', 'pending'),
        allowNull: false,
        defaultValue: 'pending',
      },
      starts_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'NULL for lifetime plans',
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancellation_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      payment_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Razorpay payment ID',
      },
      amount_paid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Amount in paise',
      },
      discount_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Discount in paise',
      },
      tax_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Tax in paise',
      },
      coupon_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'sub_coupons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      auto_renew: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      usage: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify({
          contacts_used: 0,
          templates_used: 0,
          campaigns_this_month: 0,
          messages_this_month: 0,
          team_members_used: 0,
          organizations_used: 0,
          whatsapp_numbers_used: 0,
        }),
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

    await queryInterface.addIndex('sub_subscriptions', ['user_id'], { name: 'idx_sub_subscriptions_user_id' });
    await queryInterface.addIndex('sub_subscriptions', ['plan_id'], { name: 'idx_sub_subscriptions_plan_id' });
    await queryInterface.addIndex('sub_subscriptions', ['status'], { name: 'idx_sub_subscriptions_status' });
    await queryInterface.addIndex('sub_subscriptions', ['expires_at'], { name: 'idx_sub_subscriptions_expires_at' });
    await queryInterface.addIndex('sub_subscriptions', ['user_id', 'status'], { name: 'idx_sub_subscriptions_user_status' });
    await queryInterface.addIndex('sub_subscriptions', ['created_at'], { name: 'idx_sub_subscriptions_created_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sub_subscriptions');
  },
};
