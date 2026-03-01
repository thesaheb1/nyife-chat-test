'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AutomationLog = sequelize.define(
    'AutomationLog',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      automation_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      trigger_data: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      action_result: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('success', 'failed'),
        allowNull: false,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
    },
    {
      tableName: 'auto_automation_logs',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  AutomationLog.associate = (models) => {
    AutomationLog.belongsTo(models.Automation, {
      foreignKey: 'automation_id',
      as: 'automation',
    });
  };

  return AutomationLog;
};
