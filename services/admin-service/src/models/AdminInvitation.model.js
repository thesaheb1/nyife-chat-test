'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminInvitation = sequelize.define(
    'AdminInvitation',
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
      role_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
      },
      role_title: {
        type: DataTypes.STRING(255),
        allowNull: false,
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
      tableName: 'admin_invitations',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  AdminInvitation.associate = (models) => {
    AdminInvitation.belongsTo(models.AdminRole, {
      foreignKey: 'role_id',
      as: 'role',
    });
  };

  return AdminInvitation;
};
