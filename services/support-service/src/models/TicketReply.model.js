'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TicketReply = sequelize.define(
    'TicketReply',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ticket_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      reply_type: {
        type: DataTypes.ENUM('user', 'admin', 'system'),
        allowNull: false,
      },
      message_kind: {
        type: DataTypes.ENUM('root', 'reply'),
        allowNull: false,
        defaultValue: 'reply',
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attachments: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'support_ticket_replies',
      timestamps: true,
      underscored: true,
      paranoid: false,
      updatedAt: false,
    }
  );

  TicketReply.associate = (models) => {
    TicketReply.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket',
    });
  };

  return TicketReply;
};
