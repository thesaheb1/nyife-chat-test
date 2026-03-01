'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TeamMember = sequelize.define(
    'TeamMember',
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
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      member_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      role_title: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
          len: [2, 100],
        },
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'invited'),
        allowNull: false,
        defaultValue: 'invited',
      },
      invited_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      joined_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'org_team_members',
      timestamps: true,
      underscored: true,
      paranoid: true,
      indexes: [
        {
          unique: true,
          fields: ['organization_id', 'member_user_id'],
          name: 'uq_org_team_members_org_member',
        },
      ],
    }
  );

  TeamMember.associate = (models) => {
    TeamMember.belongsTo(models.Organization, {
      foreignKey: 'organization_id',
      as: 'organization',
    });
    TeamMember.belongsTo(models.User, {
      foreignKey: 'member_user_id',
      as: 'member',
    });
    TeamMember.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'invitedBy',
    });
  };

  return TeamMember;
};
