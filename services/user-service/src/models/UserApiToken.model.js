'use strict';

const { DataTypes } = require('sequelize');

/**
 * UserApiToken model definition.
 * Stores hashed API tokens that users create for programmatic access.
 * The raw token is only shown once at creation time; only the hash is persisted.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {import('sequelize').Model} The UserApiToken model
 */
module.exports = (sequelize) => {
  const UserApiToken = sequelize.define(
    'UserApiToken',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'auth_users',
          key: 'id',
        },
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      token_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      token_prefix: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: 'user_api_tokens',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  /**
   * Define associations.
   * Called from models/index.js after all models have been initialized.
   */
  UserApiToken.associate = (models) => {
    if (models.AuthUser) {
      UserApiToken.belongsTo(models.AuthUser, {
        foreignKey: 'user_id',
        as: 'user',
      });
    }
  };

  return UserApiToken;
};
