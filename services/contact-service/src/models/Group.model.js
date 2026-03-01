'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Group = sequelize.define(
    'Group',
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
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      contact_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      type: {
        type: DataTypes.ENUM('static', 'dynamic'),
        allowNull: false,
        defaultValue: 'static',
      },
      dynamic_filters: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'contact_groups',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Group.associate = (models) => {
    Group.belongsToMany(models.Contact, {
      through: models.GroupMember,
      foreignKey: 'group_id',
      otherKey: 'contact_id',
      as: 'contacts',
    });
  };

  return Group;
};
