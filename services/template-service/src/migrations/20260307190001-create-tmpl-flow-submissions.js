'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tmpl_flow_submissions', {
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
      flow_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      meta_flow_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      contact_phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      contact_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      wa_account_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      flow_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      screen_id: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      submission_data: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      raw_payload: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      automation_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'stored',
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

    await queryInterface.addIndex('tmpl_flow_submissions', ['user_id'], {
      name: 'idx_tmpl_flow_submissions_user_id',
    });
    await queryInterface.addIndex('tmpl_flow_submissions', ['flow_id'], {
      name: 'idx_tmpl_flow_submissions_flow_id',
    });
    await queryInterface.addIndex('tmpl_flow_submissions', ['meta_flow_id'], {
      name: 'idx_tmpl_flow_submissions_meta_flow_id',
    });
    await queryInterface.addIndex('tmpl_flow_submissions', ['contact_phone'], {
      name: 'idx_tmpl_flow_submissions_contact_phone',
    });
    await queryInterface.addIndex('tmpl_flow_submissions', ['wa_account_id'], {
      name: 'idx_tmpl_flow_submissions_wa_account_id',
    });
    await queryInterface.addIndex('tmpl_flow_submissions', ['created_at'], {
      name: 'idx_tmpl_flow_submissions_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tmpl_flow_submissions');
  },
};
