'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_tags', {
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
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '#3B82F6',
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

    // Unique constraint on (user_id, name) — prevents duplicate tag names per tenant
    await queryInterface.addIndex('contact_tags', ['user_id', 'name'], {
      name: 'idx_contact_tags_user_name',
      unique: true,
    });

    await queryInterface.addIndex('contact_tags', ['user_id'], {
      name: 'idx_contact_tags_user_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_tags');
  },
};
