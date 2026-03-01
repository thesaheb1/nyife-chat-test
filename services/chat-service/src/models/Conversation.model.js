'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Conversation = sequelize.define(
    'Conversation',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      wa_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      contact_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      last_message_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_message_preview: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      unread_count: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      assigned_to: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      assigned_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('open', 'closed', 'pending'),
        allowNull: false,
        defaultValue: 'open',
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'chat_conversations',
      timestamps: true,
      underscored: true,
      paranoid: false,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  Conversation.associate = (models) => {
    Conversation.hasMany(models.ChatMessage, {
      foreignKey: 'conversation_id',
      as: 'messages',
    });
  };

  return Conversation;
};
