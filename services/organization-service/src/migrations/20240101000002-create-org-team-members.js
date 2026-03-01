'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_team_members', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'org_organizations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      member_user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'auth_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role_title: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      permissions: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'invited'),
        allowNull: false,
        defaultValue: 'invited',
      },
      invited_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      joined_at: {
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

    // Unique constraint: a user can only be a member of an organization once
    await queryInterface.addConstraint('org_team_members', {
      fields: ['organization_id', 'member_user_id'],
      type: 'unique',
      name: 'uq_org_team_members_org_member',
    });

    await queryInterface.addIndex('org_team_members', ['organization_id'], {
      name: 'idx_org_team_members_organization_id',
    });
    await queryInterface.addIndex('org_team_members', ['user_id'], {
      name: 'idx_org_team_members_user_id',
    });
    await queryInterface.addIndex('org_team_members', ['member_user_id'], {
      name: 'idx_org_team_members_member_user_id',
    });
    await queryInterface.addIndex('org_team_members', ['status'], {
      name: 'idx_org_team_members_status',
    });
    await queryInterface.addIndex('org_team_members', ['created_at'], {
      name: 'idx_org_team_members_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('org_team_members');
  },
};
