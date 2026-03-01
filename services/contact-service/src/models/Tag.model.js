'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Tag = sequelize.define(
    'Tag',
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
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      color: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '#3B82F6',
      },
    },
    {
      tableName: 'contact_tags',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  Tag.associate = (models) => {
    Tag.belongsToMany(models.Contact, {
      through: models.ContactTag,
      foreignKey: 'tag_id',
      otherKey: 'contact_id',
      as: 'contacts',
    });
  };

  return Tag;
};
