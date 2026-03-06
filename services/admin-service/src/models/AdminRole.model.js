'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminRole = sequelize.define(
    'AdminRole',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: { resources: {} },
      },
      is_system: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: 'admin_roles',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  AdminRole.associate = (models) => {
    AdminRole.hasMany(models.SubAdmin, {
      foreignKey: 'role_id',
      as: 'subAdmins',
    });
  };

  return AdminRole;
};
