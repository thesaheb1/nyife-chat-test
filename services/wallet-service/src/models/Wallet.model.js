'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Wallet = sequelize.define(
    'Wallet',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      balance: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
    },
    {
      tableName: 'wallet_wallets',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  Wallet.associate = (models) => {
    Wallet.hasMany(models.Transaction, {
      foreignKey: 'wallet_id',
      as: 'transactions',
    });
  };

  return Wallet;
};
