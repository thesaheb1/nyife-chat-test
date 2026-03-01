'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_conversations', {
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
        comment: 'WhatsApp account ID from wa_accounts',
      },
      contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'Contact WhatsApp phone number in E.164 format',
      },
      contact_name: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Contact name from WhatsApp profile',
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the most recent message',
      },
      last_message_preview: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Preview text of the last message',
      },
      unread_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of unread inbound messages',
      },
      assigned_to: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Team member user_id this conversation is assigned to',
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of the last assignment',
      },
      assigned_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'User who performed the assignment',
      },
      status: {
        type: Sequelize.ENUM('open', 'closed', 'pending'),
        allowNull: false,
        defaultValue: 'open',
        comment: 'Conversation status',
      },
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of tag strings for categorization',
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

    // Unique constraint: one conversation per user + WA account + contact phone
    await queryInterface.addConstraint('chat_conversations', {
      fields: ['user_id', 'wa_account_id', 'contact_phone'],
      type: 'unique',
      name: 'idx_chat_conv_unique',
    });

    // Composite index: user_id + last_message_at for sorting conversation lists
    await queryInterface.addIndex('chat_conversations', ['user_id', 'last_message_at'], {
      name: 'idx_chat_conv_user_last_msg',
    });

    // Index: status for filtering
    await queryInterface.addIndex('chat_conversations', ['status'], {
      name: 'idx_chat_conv_status',
    });

    // Index: assigned_to for filtering by assignment
    await queryInterface.addIndex('chat_conversations', ['assigned_to'], {
      name: 'idx_chat_conv_assigned_to',
    });

    // Composite index: user_id + status for combined filtering
    await queryInterface.addIndex('chat_conversations', ['user_id', 'status'], {
      name: 'idx_chat_conv_user_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_conversations');
  },
};
