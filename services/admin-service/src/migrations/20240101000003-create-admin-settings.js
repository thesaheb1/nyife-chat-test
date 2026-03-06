'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      value: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      group: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      updated_by: {
        type: Sequelize.CHAR(36),
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
    });

    await queryInterface.addIndex('admin_settings', ['group'], {
      name: 'idx_admin_settings_group',
    });
    await queryInterface.addIndex('admin_settings', ['key'], {
      name: 'idx_admin_settings_key',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_settings');
  },
};
