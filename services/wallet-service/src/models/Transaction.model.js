'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define(
    'Transaction',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      wallet_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('credit', 'debit'),
        allowNull: false,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      balance_after: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      source: {
        type: DataTypes.ENUM('recharge', 'message_debit', 'admin_credit', 'admin_debit', 'refund', 'subscription_payment'),
        allowNull: false,
      },
      reference_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      reference_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payment_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      payment_status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'completed',
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'wallet_transactions',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  Transaction.associate = (models) => {
    Transaction.belongsTo(models.Wallet, {
      foreignKey: 'wallet_id',
      as: 'wallet',
    });
  };

  return Transaction;
};
