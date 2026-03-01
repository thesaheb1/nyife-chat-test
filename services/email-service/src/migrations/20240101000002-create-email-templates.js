'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Unique template identifier, e.g., welcome, password_reset',
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Subject line, can contain {{variable}} placeholders',
      },
      html_body: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'HTML template with {{variable}} placeholders',
      },
      text_body: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Plain text fallback with {{variable}} placeholders',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    await queryInterface.addIndex('email_templates', ['name'], {
      name: 'idx_email_templates_name',
      unique: true,
    });
    await queryInterface.addIndex('email_templates', ['is_active'], {
      name: 'idx_email_templates_is_active',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_templates');
  },
};
