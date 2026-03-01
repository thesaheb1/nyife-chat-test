'use strict';

const { DataTypes } = require('sequelize');

/**
 * UserSettings model definition.
 * Stores per-user preference settings (language, timezone, theme, notifications).
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {import('sequelize').Model} The UserSettings model
 */
module.exports = (sequelize) => {
  const UserSettings = sequelize.define(
    'UserSettings',
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
        unique: true,
        references: {
          model: 'auth_users',
          key: 'id',
        },
      },
      language: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'en',
      },
      timezone: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Asia/Kolkata',
      },
      theme: {
        type: DataTypes.ENUM('light', 'dark', 'system'),
        allowNull: false,
        defaultValue: 'system',
      },
      notification_email: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notification_push: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notification_in_app: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'user_settings',
      timestamps: true,
      underscored: true,
      // No paranoid / soft delete for settings — cascade from auth_users handles cleanup
      paranoid: false,
    }
  );

  /**
   * Define associations.
   * Called from models/index.js after all models have been initialized.
   */
  UserSettings.associate = (models) => {
    if (models.AuthUser) {
      UserSettings.belongsTo(models.AuthUser, {
        foreignKey: 'user_id',
        as: 'user',
      });
    }
  };

  return UserSettings;
};
