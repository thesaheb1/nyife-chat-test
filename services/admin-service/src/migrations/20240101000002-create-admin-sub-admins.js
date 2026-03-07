'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_sub_admins', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.CHAR(36),
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
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      created_by: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      last_login_at: {
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

    await queryInterface.addIndex('admin_sub_admins', ['user_id'], {
      name: 'idx_admin_sub_admins_user_id',
      unique: true,
    });
    await queryInterface.addIndex('admin_sub_admins', ['role_id'], {
      name: 'idx_admin_sub_admins_role_id',
    });
    await queryInterface.addIndex('admin_sub_admins', ['created_by'], {
      name: 'idx_admin_sub_admins_created_by',
    });
    await queryInterface.addIndex('admin_sub_admins', ['status'], {
      name: 'idx_admin_sub_admins_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_sub_admins');
  },
};
