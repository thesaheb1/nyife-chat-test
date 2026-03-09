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
        allowNull: false,
      },
      registration_pin: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      quality_rating: {
        type: DataTypes.ENUM('GREEN', 'YELLOW', 'RED'),
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
      quality_rating: this.quality_rating,
      messaging_limit: this.messaging_limit,
      platform_type: this.platform_type,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  };

  WaAccount.associate = (models) => {
    WaAccount.hasMany(models.WaMessage, {
      foreignKey: 'wa_account_id',
      as: 'messages',
    });
  };

  return WaAccount;
};
