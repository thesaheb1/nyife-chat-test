'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SubscriptionRenewalAttempt = sequelize.define(
    'SubscriptionRenewalAttempt',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      subscription_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      cycle_anchor_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      attempt_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      idempotency_key: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      payment_method: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      transaction_reference_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'sub_subscription_renewal_attempts',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  SubscriptionRenewalAttempt.associate = (models) => {
    SubscriptionRenewalAttempt.belongsTo(models.Subscription, {
      foreignKey: 'subscription_id',
      as: 'subscription',
    });
  };

  return SubscriptionRenewalAttempt;
};
