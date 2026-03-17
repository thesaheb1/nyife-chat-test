'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TicketRead = sequelize.define(
    'TicketRead',
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
      actor_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
      },
      actor_type: {
        type: DataTypes.ENUM('user', 'admin'),
        allowNull: false,
      },
      last_read_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      last_read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'support_ticket_reads',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  TicketRead.associate = (models) => {
    TicketRead.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket',
    });
  };

  return TicketRead;
};
