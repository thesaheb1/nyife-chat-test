'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallet_transactions', {
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
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'wallet_wallets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('credit', 'debit'),
        allowNull: false,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      balance_after: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      source: {
        type: Sequelize.ENUM('recharge', 'message_debit', 'admin_credit', 'admin_debit', 'refund', 'subscription_payment'),
        allowNull: false,
      },
      reference_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      reference_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      payment_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      payment_status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'completed',
      },
      meta: {
        type: Sequelize.JSON,
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

    await queryInterface.addIndex('wallet_transactions', ['user_id'], {
      name: 'idx_wallet_transactions_user_id',
    });
    await queryInterface.addIndex('wallet_transactions', ['wallet_id'], {
      name: 'idx_wallet_transactions_wallet_id',
    });
    await queryInterface.addIndex('wallet_transactions', ['type'], {
      name: 'idx_wallet_transactions_type',
    });
    await queryInterface.addIndex('wallet_transactions', ['source'], {
      name: 'idx_wallet_transactions_source',
    });
    await queryInterface.addIndex('wallet_transactions', ['created_at'], {
      name: 'idx_wallet_transactions_created_at',
    });
    await queryInterface.addIndex('wallet_transactions', ['payment_id'], {
      name: 'idx_wallet_transactions_payment_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wallet_transactions');
  },
};
