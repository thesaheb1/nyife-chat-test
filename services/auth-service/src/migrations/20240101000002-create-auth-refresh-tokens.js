'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_refresh_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'auth_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      token: {
        type: Sequelize.STRING(500),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      device_info: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('auth_refresh_tokens', ['user_id'], {
      name: 'idx_auth_refresh_tokens_user_id',
    });
    await queryInterface.addIndex('auth_refresh_tokens', ['token'], {
      name: 'idx_auth_refresh_tokens_token',
      unique: true,
    });
    await queryInterface.addIndex('auth_refresh_tokens', ['expires_at'], {
      name: 'idx_auth_refresh_tokens_expires_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auth_refresh_tokens');
  },
};
