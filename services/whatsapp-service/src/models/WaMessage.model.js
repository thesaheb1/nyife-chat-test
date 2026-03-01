'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WaMessage = sequelize.define(
    'WaMessage',
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
        allowNull: false,
      },
      contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      direction: {
        type: DataTypes.ENUM('inbound', 'outbound'),
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      content: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      meta_message_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      template_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      campaign_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      pricing_model: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      pricing_category: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
    },
    {
      tableName: 'wa_messages',
      timestamps: true,
      underscored: true,
      paranoid: false, // Messages are not soft-deleted
    }
  );

  WaMessage.associate = (models) => {
    WaMessage.belongsTo(models.WaAccount, {
      foreignKey: 'wa_account_id',
      as: 'waAccount',
    });
  };

  return WaMessage;
};
