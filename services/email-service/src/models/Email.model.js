'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Email = sequelize.define(
    'Email',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      type: {
        type: DataTypes.ENUM('transactional', 'marketing', 'admin_broadcast'),
        allowNull: false,
        defaultValue: 'transactional',
      },
      from_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      from_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      to_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      to_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      html_body: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      text_body: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      template_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      variables: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'sent', 'failed', 'bounced'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      smtp_message_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      retry_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'email_emails',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  return Email;
};
