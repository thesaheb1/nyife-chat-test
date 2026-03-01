'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminBroadcast = sequelize.define(
    'AdminBroadcast',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      admin_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      target_type: {
        type: DataTypes.ENUM('all', 'specific_users'),
        allowNull: false,
        defaultValue: 'all',
      },
      target_user_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      sent_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'notif_admin_broadcasts',
      timestamps: true,
      underscored: true,
    }
  );

  return AdminBroadcast;
};
