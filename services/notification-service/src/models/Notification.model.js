'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define(
    'Notification',
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
      sender_type: {
        type: DataTypes.ENUM('system', 'admin'),
        allowNull: false,
        defaultValue: 'system',
      },
      type: {
        type: DataTypes.ENUM('info', 'warning', 'success', 'error', 'action'),
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM('general', 'support', 'subscription', 'campaign', 'system', 'promotion'),
        allowNull: false,
        defaultValue: 'general',
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      action_url: {
        type: DataTypes.STRING(2000),
        allowNull: true,
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'notif_notifications',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  return Notification;
};
