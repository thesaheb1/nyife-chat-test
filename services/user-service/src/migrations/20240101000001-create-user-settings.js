'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('user_settings', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('user_settings', ['user_id'], {
      name: 'idx_user_settings_user_id',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('user_settings', 'idx_user_settings_user_id');
    await queryInterface.dropTable('user_settings');
  },
};
