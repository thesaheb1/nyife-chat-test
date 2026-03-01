'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auto_webhooks', {
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
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      url: {
        type: Sequelize.STRING(2000),
        allowNull: false,
        comment: 'Webhook endpoint URL',
      },
      events: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Array of event types to trigger this webhook',
      },
      secret: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Secret for HMAC signature verification',
      },
      headers: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Custom headers to include in webhook requests',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_triggered_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failure_count: {
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Indexes
    await queryInterface.addIndex('auto_webhooks', ['user_id'], {
      name: 'idx_auto_webhooks_user_id',
    });
    await queryInterface.addIndex('auto_webhooks', ['is_active'], {
      name: 'idx_auto_webhooks_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auto_webhooks');
  },
};
