'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContactTag = sequelize.define(
    'ContactTag',
    {
      contact_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      tag_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
    },
    {
      tableName: 'contact_contact_tags',
      timestamps: false,
      underscored: true,
    }
  );

  return ContactTag;
};
