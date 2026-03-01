'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_organizations', {
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
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(200),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      logo_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
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

    await queryInterface.addIndex('org_organizations', ['user_id'], {
      name: 'idx_org_organizations_user_id',
    });
    await queryInterface.addIndex('org_organizations', ['slug'], {
      name: 'idx_org_organizations_slug',
      unique: true,
    });
    await queryInterface.addIndex('org_organizations', ['status'], {
      name: 'idx_org_organizations_status',
    });
    await queryInterface.addIndex('org_organizations', ['created_at'], {
      name: 'idx_org_organizations_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('org_organizations');
  },
};
