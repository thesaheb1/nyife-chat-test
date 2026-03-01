'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EmailTemplate = sequelize.define(
    'EmailTemplate',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      subject: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      html_body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      text_body: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'email_templates',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  return EmailTemplate;
};
