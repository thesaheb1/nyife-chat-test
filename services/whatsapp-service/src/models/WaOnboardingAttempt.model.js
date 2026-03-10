'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WaOnboardingAttempt = sequelize.define(
    'WaOnboardingAttempt',
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
      wa_account_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      signup_session_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      business_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      waba_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone_number_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed', 'reconcile_pending'),
        allowNull: false,
        defaultValue: 'pending',
      },
      step_details: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      warnings: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      last_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_retryable: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'wa_onboarding_attempts',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  WaOnboardingAttempt.associate = (models) => {
    WaOnboardingAttempt.belongsTo(models.WaAccount, {
      foreignKey: 'wa_account_id',
      as: 'account',
    });
  };

  return WaOnboardingAttempt;
};
