'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant/account owner FK to auth_users',
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      contact_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      type: {
        type: Sequelize.ENUM('static', 'dynamic'),
        allowNull: false,
        defaultValue: 'static',
      },
      dynamic_filters: {
        type: Sequelize.JSON,
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

    await queryInterface.addIndex('contact_groups', ['user_id'], {
      name: 'idx_contact_groups_user_id',
    });

    await queryInterface.addIndex('contact_groups', ['user_id', 'name'], {
      name: 'idx_contact_groups_user_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_groups');
  },
};
