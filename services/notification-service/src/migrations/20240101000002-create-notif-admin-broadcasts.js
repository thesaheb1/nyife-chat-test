'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notif_admin_broadcasts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      admin_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Admin user who created this broadcast',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      target_type: {
        type: Sequelize.ENUM('all', 'specific_users'),
        allowNull: false,
        defaultValue: 'all',
      },
      target_user_ids: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of specific user IDs when target_type is specific_users',
      },
      sent_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    // Indexes
    await queryInterface.addIndex('notif_admin_broadcasts', ['admin_id'], {
      name: 'idx_notif_admin_broadcasts_admin_id',
    });
    await queryInterface.addIndex('notif_admin_broadcasts', ['target_type'], {
      name: 'idx_notif_admin_broadcasts_target_type',
    });
    await queryInterface.addIndex('notif_admin_broadcasts', ['created_at'], {
      name: 'idx_notif_admin_broadcasts_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notif_admin_broadcasts');
  },
};
