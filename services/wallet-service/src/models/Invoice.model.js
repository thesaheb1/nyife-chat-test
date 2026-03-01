'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Invoice = sequelize.define(
    'Invoice',
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
      invoice_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      type: {
        type: DataTypes.ENUM('subscription', 'recharge', 'message_charges'),
        allowNull: false,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tax_amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tax_details: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      billing_info: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('paid', 'pending', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      paid_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      reference_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      reference_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
    },
    {
      tableName: 'wallet_invoices',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  Invoice.associate = (models) => {
    Invoice.belongsTo(models.Wallet, {
      foreignKey: 'user_id',
      targetKey: 'user_id',
      as: 'wallet',
    });
  };

  return Invoice;
};
