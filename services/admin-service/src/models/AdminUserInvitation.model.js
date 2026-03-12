'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminUserInvitation = sequelize.define(
    'AdminUserInvitation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      invited_by_user_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
      },
      accepted_user_id: {
        type: DataTypes.CHAR(36),
        allowNull: true,
      },
      invite_token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'expired', 'revoked'),
        allowNull: false,
        defaultValue: 'pending',
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      accepted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'admin_user_invitations',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  return AdminUserInvitation;
};
