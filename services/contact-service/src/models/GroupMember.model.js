'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GroupMember = sequelize.define(
    'GroupMember',
    {
      contact_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      group_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      added_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'contact_group_members',
      timestamps: false,
      underscored: true,
    }
  );

  return GroupMember;
};
