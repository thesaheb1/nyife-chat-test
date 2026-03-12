'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_invitations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'admin_roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role_title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      invited_by_user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      accepted_user_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
      },
      invite_token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'expired', 'revoked'),
        allowNull: false,
        defaultValue: 'pending',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      accepted_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('admin_invitations', ['email'], {
      name: 'idx_admin_invitations_email',
    });
    await queryInterface.addIndex('admin_invitations', ['role_id'], {
      name: 'idx_admin_invitations_role_id',
    });
    await queryInterface.addIndex('admin_invitations', ['status'], {
      name: 'idx_admin_invitations_status',
    });
    await queryInterface.addIndex('admin_invitations', ['expires_at'], {
      name: 'idx_admin_invitations_expires_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_invitations');
  },
};
