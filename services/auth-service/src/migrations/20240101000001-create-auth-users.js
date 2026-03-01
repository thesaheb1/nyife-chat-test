'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM('user', 'admin', 'super_admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended', 'pending_verification'),
        allowNull: false,
        defaultValue: 'pending_verification',
      },
      email_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      email_verification_expires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      password_reset_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      password_reset_expires: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_login_ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      login_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      google_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      facebook_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('auth_users', ['email'], {
      name: 'idx_auth_users_email',
      unique: true,
    });
    await queryInterface.addIndex('auth_users', ['status'], {
      name: 'idx_auth_users_status',
    });
    await queryInterface.addIndex('auth_users', ['google_id'], {
      name: 'idx_auth_users_google_id',
    });
    await queryInterface.addIndex('auth_users', ['facebook_id'], {
      name: 'idx_auth_users_facebook_id',
    });
    await queryInterface.addIndex('auth_users', ['created_at'], {
      name: 'idx_auth_users_created_at',
    });
    await queryInterface.addIndex('auth_users', ['email_verification_token'], {
      name: 'idx_auth_users_email_verification_token',
    });
    await queryInterface.addIndex('auth_users', ['password_reset_token'], {
      name: 'idx_auth_users_password_reset_token',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auth_users');
  },
};
