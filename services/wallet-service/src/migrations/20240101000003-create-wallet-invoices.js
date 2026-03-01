'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallet_invoices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'auth_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      invoice_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      type: {
        type: Sequelize.ENUM('subscription', 'recharge', 'message_charges'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      tax_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      tax_details: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      billing_info: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('paid', 'pending', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      paid_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reference_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      reference_id: {
        type: Sequelize.STRING(100),
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

    await queryInterface.addIndex('wallet_invoices', ['user_id'], {
      name: 'idx_wallet_invoices_user_id',
    });
    await queryInterface.addIndex('wallet_invoices', ['invoice_number'], {
      name: 'idx_wallet_invoices_invoice_number',
      unique: true,
    });
    await queryInterface.addIndex('wallet_invoices', ['status'], {
      name: 'idx_wallet_invoices_status',
    });
    await queryInterface.addIndex('wallet_invoices', ['created_at'], {
      name: 'idx_wallet_invoices_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wallet_invoices');
  },
};
