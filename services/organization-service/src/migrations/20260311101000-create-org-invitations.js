'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_invitations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      invited_by_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      accepted_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
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
      role_title: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      permissions: {
        type: Sequelize.JSON,
        allowNull: false,
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

    await queryInterface.addIndex('org_invitations', ['organization_id'], {
      name: 'idx_org_invitations_organization_id',
    });
    await queryInterface.addIndex('org_invitations', ['email'], {
      name: 'idx_org_invitations_email',
    });
    await queryInterface.addIndex('org_invitations', ['status'], {
      name: 'idx_org_invitations_status',
    });
    await queryInterface.addIndex('org_invitations', ['expires_at'], {
      name: 'idx_org_invitations_expires_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('org_invitations');
  },
};
