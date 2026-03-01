'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('camp_campaigns', {
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
        comment: 'WhatsApp account used for sending',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Template used for this campaign',
      },
      status: {
        type: Sequelize.ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      type: {
        type: Sequelize.ENUM('immediate', 'scheduled'),
        allowNull: false,
        defaultValue: 'immediate',
      },
      target_type: {
        type: Sequelize.ENUM('group', 'contacts', 'tags', 'all'),
        allowNull: false,
      },
      target_config: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'JSON: { group_ids:[], contact_ids:[], tag_ids:[], exclude_tag_ids:[] }',
      },
      variables_mapping: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Maps template {{1}}, {{2}} to contact fields',
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      total_recipients: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sent_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      delivered_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      read_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pending_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      estimated_cost: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Estimated cost in paise',
      },
      actual_cost: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Actual cost in paise',
      },
      error_summary: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Summary of errors encountered during campaign',
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
    await queryInterface.addIndex('camp_campaigns', ['user_id'], {
      name: 'idx_camp_campaigns_user_id',
    });
    await queryInterface.addIndex('camp_campaigns', ['status'], {
      name: 'idx_camp_campaigns_status',
    });
    await queryInterface.addIndex('camp_campaigns', ['user_id', 'status'], {
      name: 'idx_camp_campaigns_user_id_status',
    });
    await queryInterface.addIndex('camp_campaigns', ['user_id', 'created_at'], {
      name: 'idx_camp_campaigns_user_id_created_at',
    });
    await queryInterface.addIndex('camp_campaigns', ['template_id'], {
      name: 'idx_camp_campaigns_template_id',
    });
    await queryInterface.addIndex('camp_campaigns', ['wa_account_id'], {
      name: 'idx_camp_campaigns_wa_account_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('camp_campaigns');
  },
};
