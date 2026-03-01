'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wa_messages', {
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
        references: {
          model: 'wa_accounts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'FK to wa_accounts',
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Contact phone number in E.164 format',
      },
      direction: {
        type: Sequelize.ENUM('inbound', 'outbound'),
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Message type: text, image, template, interactive, etc.',
      },
      content: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Full message payload (type-specific)',
      },
      meta_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'WhatsApp wamid from Meta API',
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Meta API error code on failure',
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Meta API error description on failure',
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'FK to template if message is a template send',
      },
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'FK to campaign if message is part of a campaign',
      },
      pricing_model: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Meta pricing model (e.g., CBP)',
      },
      pricing_category: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Meta pricing category (e.g., marketing, utility, service)',
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

    // Composite index for conversation lookups
    await queryInterface.addIndex('wa_messages', ['user_id', 'contact_phone', 'created_at'], {
      name: 'idx_wa_messages_user_contact_created',
    });
    // Index for looking up messages by Meta message ID (webhook status updates)
    await queryInterface.addIndex('wa_messages', ['meta_message_id'], {
      name: 'idx_wa_messages_meta_message_id',
    });
    // Index for account-scoped queries
    await queryInterface.addIndex('wa_messages', ['wa_account_id'], {
      name: 'idx_wa_messages_wa_account_id',
    });
    // Index for campaign-scoped queries
    await queryInterface.addIndex('wa_messages', ['campaign_id'], {
      name: 'idx_wa_messages_campaign_id',
    });
    // Composite index for user timeline queries
    await queryInterface.addIndex('wa_messages', ['user_id', 'created_at'], {
      name: 'idx_wa_messages_user_created',
    });
    // Index for status filtering
    await queryInterface.addIndex('wa_messages', ['status'], {
      name: 'idx_wa_messages_status',
    });
    // Index for direction filtering
    await queryInterface.addIndex('wa_messages', ['direction'], {
      name: 'idx_wa_messages_direction',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wa_messages');
  },
};
