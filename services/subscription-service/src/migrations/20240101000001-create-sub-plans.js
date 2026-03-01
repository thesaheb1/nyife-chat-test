'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sub_plans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('monthly', 'yearly', 'lifetime'),
        allowNull: false,
      },
      price: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Price in paise',
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
      max_contacts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_templates: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_campaigns_per_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_messages_per_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_team_members: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_organizations: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      max_whatsapp_numbers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      has_priority_support: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      marketing_message_price: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Price per marketing message in paise',
      },
      utility_message_price: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Price per utility message in paise',
      },
      auth_message_price: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Price per auth message in paise',
      },
      features: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Extensible feature flags',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
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

    await queryInterface.addIndex('sub_plans', ['slug'], { name: 'idx_sub_plans_slug', unique: true });
    await queryInterface.addIndex('sub_plans', ['is_active'], { name: 'idx_sub_plans_is_active' });
    await queryInterface.addIndex('sub_plans', ['sort_order'], { name: 'idx_sub_plans_sort_order' });
    await queryInterface.addIndex('sub_plans', ['type'], { name: 'idx_sub_plans_type' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sub_plans');
  },
};
