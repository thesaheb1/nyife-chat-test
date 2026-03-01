'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('camp_campaign_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to camp_campaigns.id',
      },
      contact_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Reference to contact in contact-service',
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'queued', 'sent', 'delivered', 'read', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      meta_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Message ID returned by Meta API',
      },
      variables: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Resolved variables for this specific contact',
      },
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cost: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cost in paise for this individual message',
      },
      retry_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_retries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
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
    await queryInterface.addIndex('camp_campaign_messages', ['campaign_id', 'status'], {
      name: 'idx_camp_messages_campaign_id_status',
    });
    await queryInterface.addIndex('camp_campaign_messages', ['contact_phone'], {
      name: 'idx_camp_messages_contact_phone',
    });
    await queryInterface.addIndex('camp_campaign_messages', ['campaign_id'], {
      name: 'idx_camp_messages_campaign_id',
    });
    await queryInterface.addIndex('camp_campaign_messages', ['meta_message_id'], {
      name: 'idx_camp_messages_meta_message_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('camp_campaign_messages');
  },
};
