'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('user_api_tokens', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('user_api_tokens', ['user_id'], {
      name: 'idx_user_api_tokens_user_id',
    });

    await queryInterface.addIndex('user_api_tokens', ['token_hash'], {
      name: 'idx_user_api_tokens_token_hash',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('user_api_tokens', 'idx_user_api_tokens_token_hash');
    await queryInterface.removeIndex('user_api_tokens', 'idx_user_api_tokens_user_id');
    await queryInterface.dropTable('user_api_tokens');
  },
};
