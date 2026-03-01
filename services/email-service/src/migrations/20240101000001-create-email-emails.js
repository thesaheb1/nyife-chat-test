'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_emails', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('transactional', 'marketing', 'admin_broadcast'),
        allowNull: false,
        defaultValue: 'transactional',
      },
      from_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      from_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      to_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      to_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      html_body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      text_body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      template_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'References email_templates.name',
      },
      variables: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Template variables used for rendering',
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'failed', 'bounced'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      smtp_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      retry_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      meta: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Related entity info, e.g., { entity: "campaign", entity_id: "..." }',
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
    await queryInterface.addIndex('email_emails', ['to_email'], {
      name: 'idx_email_emails_to_email',
    });
    await queryInterface.addIndex('email_emails', ['status'], {
      name: 'idx_email_emails_status',
    });
    await queryInterface.addIndex('email_emails', ['template_name'], {
      name: 'idx_email_emails_template_name',
    });
    await queryInterface.addIndex('email_emails', ['status', 'created_at'], {
      name: 'idx_email_emails_status_created_at',
    });
    await queryInterface.addIndex('email_emails', ['sent_at'], {
      name: 'idx_email_emails_sent_at',
    });
    await queryInterface.addIndex('email_emails', ['type'], {
      name: 'idx_email_emails_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_emails');
  },
};
