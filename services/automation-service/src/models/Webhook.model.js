'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Webhook = sequelize.define(
    'Webhook',
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
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING(2000),
        allowNull: false,
      },
      events: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      secret: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      headers: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_triggered_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failure_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'auto_webhooks',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  return Webhook;
};
