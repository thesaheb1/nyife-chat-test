'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tmpl_templates', {
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
      name: {
        type: Sequelize.STRING(512),
        allowNull: false,
      },
      display_name: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      language: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'en_US',
      },
      category: {
        type: Sequelize.ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION'),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('standard', 'authentication', 'carousel', 'flow', 'list_menu'),
        allowNull: false,
        defaultValue: 'standard',
      },
      status: {
        type: Sequelize.ENUM('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      components: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      example_values: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      meta_template_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
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

    // Individual column indexes
    await queryInterface.addIndex('tmpl_templates', ['user_id'], {
      name: 'idx_tmpl_templates_user_id',
    });
    await queryInterface.addIndex('tmpl_templates', ['status'], {
      name: 'idx_tmpl_templates_status',
    });
    await queryInterface.addIndex('tmpl_templates', ['category'], {
      name: 'idx_tmpl_templates_category',
    });
    await queryInterface.addIndex('tmpl_templates', ['type'], {
      name: 'idx_tmpl_templates_type',
    });
    await queryInterface.addIndex('tmpl_templates', ['waba_id'], {
      name: 'idx_tmpl_templates_waba_id',
    });
    await queryInterface.addIndex('tmpl_templates', ['meta_template_id'], {
      name: 'idx_tmpl_templates_meta_template_id',
    });
    await queryInterface.addIndex('tmpl_templates', ['created_at'], {
      name: 'idx_tmpl_templates_created_at',
    });

    // Composite indexes
    await queryInterface.addIndex('tmpl_templates', ['user_id', 'status'], {
      name: 'idx_tmpl_templates_user_status',
    });
    await queryInterface.addIndex('tmpl_templates', ['user_id', 'waba_id', 'name'], {
      name: 'idx_tmpl_templates_user_waba_name',
      unique: true,
      where: { deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tmpl_templates');
  },
};
