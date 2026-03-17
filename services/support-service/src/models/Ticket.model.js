'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Ticket = sequelize.define(
    'Ticket',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ticket_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      category: {
        type: DataTypes.ENUM('billing', 'technical', 'account', 'whatsapp', 'other'),
        allowNull: false,
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      status: {
        type: DataTypes.ENUM('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'open',
      },
      assigned_to: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      assigned_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_message_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_message_preview: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      closed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      satisfaction_rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      satisfaction_feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_by: {
        type: DataTypes.CHAR(36),
        allowNull: true,
      },
    },
    {
      tableName: 'support_tickets',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  Ticket.associate = (models) => {
    Ticket.hasMany(models.TicketReply, {
      foreignKey: 'ticket_id',
      as: 'replies',
    });

    Ticket.hasMany(models.TicketRead, {
      foreignKey: 'ticket_id',
      as: 'reads',
    });
  };

  return Ticket;
};
