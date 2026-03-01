'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Contact = sequelize.define(
    'Contact',
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
      phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      custom_fields: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      whatsapp_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      opted_in: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      opted_in_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_messaged_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      message_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      source: {
        type: DataTypes.ENUM('manual', 'csv_import', 'whatsapp_incoming', 'api'),
        allowNull: false,
        defaultValue: 'manual',
      },
    },
    {
      tableName: 'contact_contacts',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Contact.associate = (models) => {
    Contact.belongsToMany(models.Tag, {
      through: models.ContactTag,
      foreignKey: 'contact_id',
      otherKey: 'tag_id',
      as: 'tags',
    });

    Contact.belongsToMany(models.Group, {
      through: models.GroupMember,
      foreignKey: 'contact_id',
      otherKey: 'group_id',
      as: 'groups',
    });
  };

  return Contact;
};
