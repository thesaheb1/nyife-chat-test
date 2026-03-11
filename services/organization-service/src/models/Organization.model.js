'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Organization = sequelize.define(
    'Organization',
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
        type: DataTypes.STRING(200),
        allowNull: false,
        validate: {
          len: [2, 200],
        },
      },
      slug: {
        type: DataTypes.STRING(200),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      logo_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      tableName: 'org_organizations',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Organization.associate = (models) => {
    Organization.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'owner',
    });
    Organization.hasMany(models.TeamMember, {
      foreignKey: 'organization_id',
      as: 'teamMembers',
    });
    Organization.hasMany(models.Invitation, {
      foreignKey: 'organization_id',
      as: 'invitations',
    });
  };

  return Organization;
};
