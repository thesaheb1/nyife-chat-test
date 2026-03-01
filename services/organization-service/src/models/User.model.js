'use strict';

const { DataTypes } = require('sequelize');

/**
 * Lightweight reference model for auth_users table.
 * Used only for Sequelize associations (belongsTo) within the organization-service.
 * The auth-service owns the full User model and migrations.
 */
module.exports = (sequelize) => {
  const User = sequelize.define(
    'User',
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
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    {
      tableName: 'auth_users',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  return User;
};
