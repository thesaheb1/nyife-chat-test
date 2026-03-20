'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WaAccount = sequelize.define(
    'WaAccount',
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
      waba_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone_number_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      display_phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      verified_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      business_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      access_token: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      registration_pin: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      credential_source: {
        type: DataTypes.ENUM('provider_system_user', 'legacy_embedded_user_token'),
        allowNull: false,
        defaultValue: 'legacy_embedded_user_token',
      },
      assigned_system_user_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      quality_rating: {
        type: DataTypes.ENUM('GREEN', 'YELLOW', 'RED', 'UNKNOWN'),
        allowNull: true,
      },
      name_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      number_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      code_verification_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      account_review_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      messaging_limit: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      platform_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'restricted', 'banned'),
        allowNull: false,
        defaultValue: 'active',
      },
      app_subscription_status: {
        type: DataTypes.ENUM('unknown', 'subscribed', 'not_subscribed', 'failed'),
        allowNull: false,
        defaultValue: 'unknown',
      },
      credit_sharing_status: {
        type: DataTypes.ENUM('unknown', 'not_required', 'attached', 'failed'),
        allowNull: false,
        defaultValue: 'unknown',
      },
      onboarding_status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'active', 'failed', 'needs_reconcile', 'inactive'),
        allowNull: false,
        defaultValue: 'needs_reconcile',
      },
      last_health_checked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_onboarded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_onboarding_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      webhook_secret: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'wa_accounts',
      timestamps: true,
      underscored: true,
      paranoid: true,
      defaultScope: {
        attributes: {
          exclude: ['access_token', 'registration_pin', 'webhook_secret'],
        },
      },
      scopes: {
        withToken: {
          attributes: { include: ['access_token'] },
        },
        withSecret: {
          attributes: { include: ['webhook_secret'] },
        },
        withAll: {
          attributes: { include: ['access_token', 'registration_pin', 'webhook_secret'] },
        },
      },
    }
  );

  /**
   * Returns a safe JSON representation of the account, excluding sensitive fields.
   */
  WaAccount.prototype.toSafeJSON = function () {
    return {
      id: this.id,
      user_id: this.user_id,
      waba_id: this.waba_id,
      phone_number_id: this.phone_number_id,
      display_phone: this.display_phone,
      verified_name: this.verified_name,
      business_id: this.business_id,
      credential_source: this.credential_source,
      assigned_system_user_id: this.assigned_system_user_id,
      quality_rating: this.quality_rating,
      name_status: this.name_status,
      number_status: this.number_status,
      code_verification_status: this.code_verification_status,
      account_review_status: this.account_review_status,
      messaging_limit: this.messaging_limit,
      platform_type: this.platform_type,
      status: this.status,
      app_subscription_status: this.app_subscription_status,
      credit_sharing_status: this.credit_sharing_status,
      onboarding_status: this.onboarding_status,
      last_health_checked_at: this.last_health_checked_at,
      last_onboarded_at: this.last_onboarded_at,
      last_onboarding_error: this.last_onboarding_error,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  };

  WaAccount.associate = (models) => {
    WaAccount.hasMany(models.WaMessage, {
      foreignKey: 'wa_account_id',
      as: 'messages',
    });
    WaAccount.hasMany(models.WaOnboardingAttempt, {
      foreignKey: 'wa_account_id',
      as: 'onboardingAttempts',
    });
  };

  return WaAccount;
};
