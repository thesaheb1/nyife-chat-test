'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auto_automation_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      automation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'References auto_automations.id',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant user ID from auth_users',
      },
      trigger_data: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Snapshot of the trigger payload that activated this automation',
      },
      action_result: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Result of the automation action execution',
      },
      status: {
        type: Sequelize.ENUM('success', 'failed'),
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Phone number of the contact that triggered the automation',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Indexes
    await queryInterface.addIndex('auto_automation_logs', ['automation_id'], {
      name: 'idx_auto_automation_logs_automation_id',
    });
    await queryInterface.addIndex('auto_automation_logs', ['user_id', 'created_at'], {
      name: 'idx_auto_automation_logs_user_created',
    });
    await queryInterface.addIndex('auto_automation_logs', ['contact_phone'], {
      name: 'idx_auto_automation_logs_contact_phone',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auto_automation_logs');
  },
};
