'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Invitation = sequelize.define(
    'Invitation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      invited_by_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      accepted_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
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
      role_title: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
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
      tableName: 'org_invitations',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Invitation.associate = (models) => {
    Invitation.belongsTo(models.Organization, {
      foreignKey: 'organization_id',
      as: 'organization',
    });
    Invitation.belongsTo(models.User, {
      foreignKey: 'invited_by_user_id',
      as: 'invitedBy',
    });
    Invitation.belongsTo(models.User, {
      foreignKey: 'accepted_user_id',
      as: 'acceptedBy',
    });
  };

  return Invitation;
};
