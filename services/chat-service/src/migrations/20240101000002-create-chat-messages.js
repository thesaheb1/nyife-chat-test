'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'FK to chat_conversations.id',
        references: {
          model: 'chat_conversations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant user ID from auth_users',
      },
      direction: {
        type: Sequelize.ENUM('inbound', 'outbound'),
        allowNull: false,
        comment: 'Message direction: inbound from contact, outbound from user/system',
      },
      sender_type: {
        type: Sequelize.ENUM('contact', 'user', 'team_member', 'system'),
        allowNull: false,
        comment: 'Who sent the message',
      },
      sender_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'User ID or team member ID for outbound; null for contact inbound',
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Message type: text, image, video, audio, document, template, location, contacts, interactive, sticker, reaction, etc.',
      },
      content: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Message content payload (type-specific structure)',
      },
      meta_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'WhatsApp Cloud API message ID (wamid)',
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Message delivery status',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Composite index: conversation_id + created_at for message history queries
    await queryInterface.addIndex('chat_messages', ['conversation_id', 'created_at'], {
      name: 'idx_chat_msg_conv_created',
    });

    // Index: meta_message_id for webhook status update lookups
    await queryInterface.addIndex('chat_messages', ['meta_message_id'], {
      name: 'idx_chat_msg_meta_id',
    });

    // Composite index: user_id + created_at for tenant-scoped queries
    await queryInterface.addIndex('chat_messages', ['user_id', 'created_at'], {
      name: 'idx_chat_msg_user_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_messages');
  },
};
