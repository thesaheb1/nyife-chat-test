'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SubAdmin = sequelize.define(
    'SubAdmin',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        unique: true,
      },
      role_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_by: {
        type: DataTypes.CHAR(36),
        allowNull: false,
      },
      last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'admin_sub_admins',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  SubAdmin.associate = (models) => {
    SubAdmin.belongsTo(models.AdminRole, {
      foreignKey: 'role_id',
      as: 'role',
    });
  };

  return SubAdmin;
};
