'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auto_automations', {
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
      wa_account_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'WhatsApp account this automation applies to',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'draft'),
        allowNull: false,
        defaultValue: 'draft',
      },
      trigger_config: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'JSON: { trigger_type, trigger_value, match_case, ... }',
      },
      action_config: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'JSON: action definition (reply content, flow steps, webhook URL, etc.)',
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Higher value = checked first',
      },
      conditions: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Optional additional conditions (time_of_day, etc.)',
      },
      stats: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: JSON.stringify({ triggered_count: 0, last_triggered_at: null }),
        comment: 'Automation trigger statistics',
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
    await queryInterface.addIndex('auto_automations', ['user_id'], {
      name: 'idx_auto_automations_user_id',
    });
    await queryInterface.addIndex('auto_automations', ['status'], {
      name: 'idx_auto_automations_status',
    });
    await queryInterface.addIndex('auto_automations', ['user_id', 'status', 'priority'], {
      name: 'idx_auto_automations_user_status_priority',
    });
    await queryInterface.addIndex('auto_automations', ['wa_account_id'], {
      name: 'idx_auto_automations_wa_account_id',
    });
    await queryInterface.addIndex('auto_automations', ['type'], {
      name: 'idx_auto_automations_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auto_automations');
  },
};
