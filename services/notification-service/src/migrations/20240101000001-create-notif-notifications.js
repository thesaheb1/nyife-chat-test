'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notif_notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant user ID from auth_users',
      },
      sender_type: {
        type: Sequelize.ENUM('system', 'admin'),
        allowNull: false,
        defaultValue: 'system',
      },
      type: {
        type: Sequelize.ENUM('info', 'warning', 'success', 'error', 'action'),
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM('general', 'support', 'subscription', 'campaign', 'system', 'promotion'),
        allowNull: false,
        defaultValue: 'general',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      action_url: {
        type: Sequelize.STRING(2000),
        allowNull: true,
        comment: 'Link to relevant page',
      },
      meta: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Optional metadata associated with the notification',
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      read_at: {
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
    });

    // Indexes
    await queryInterface.addIndex('notif_notifications', ['user_id'], {
      name: 'idx_notif_notifications_user_id',
    });
    await queryInterface.addIndex('notif_notifications', ['user_id', 'is_read'], {
      name: 'idx_notif_notifications_user_id_is_read',
    });
    await queryInterface.addIndex('notif_notifications', ['user_id', 'category'], {
      name: 'idx_notif_notifications_user_id_category',
    });
    await queryInterface.addIndex('notif_notifications', ['created_at'], {
      name: 'idx_notif_notifications_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notif_notifications');
  },
};
