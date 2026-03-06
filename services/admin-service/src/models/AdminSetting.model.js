'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminSetting = sequelize.define(
    'AdminSetting',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      value: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      group: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      updated_by: {
        type: DataTypes.CHAR(36),
        allowNull: true,
      },
    },
    {
      tableName: 'admin_settings',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  return AdminSetting;
};
