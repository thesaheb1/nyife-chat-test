'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tmpl_flows', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      waba_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      wa_account_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      meta_flow_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      categories: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'THROTTLED', 'BLOCKED', 'DEPRECATED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      json_version: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '7.1',
      },
      json_definition: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      editor_state: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      data_exchange_config: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      preview_url: {
        type: Sequelize.STRING(1024),
        allowNull: true,
      },
      validation_errors: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      has_local_changes: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_synced_at: {
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

    await queryInterface.addIndex('tmpl_flows', ['user_id'], {
      name: 'idx_tmpl_flows_user_id',
    });
    await queryInterface.addIndex('tmpl_flows', ['waba_id'], {
      name: 'idx_tmpl_flows_waba_id',
    });
    await queryInterface.addIndex('tmpl_flows', ['wa_account_id'], {
      name: 'idx_tmpl_flows_wa_account_id',
    });
    await queryInterface.addIndex('tmpl_flows', ['meta_flow_id'], {
      name: 'idx_tmpl_flows_meta_flow_id',
    });
    await queryInterface.addIndex('tmpl_flows', ['status'], {
      name: 'idx_tmpl_flows_status',
    });
    await queryInterface.addIndex('tmpl_flows', ['user_id', 'waba_id', 'name'], {
      name: 'idx_tmpl_flows_user_waba_name',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tmpl_flows');
  },
};
