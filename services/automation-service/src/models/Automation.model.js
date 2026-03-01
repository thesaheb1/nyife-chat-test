'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Automation = sequelize.define(
    'Automation',
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
      wa_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'draft'),
        allowNull: false,
        defaultValue: 'draft',
      },
      trigger_config: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      action_config: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      conditions: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      stats: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: { triggered_count: 0, last_triggered_at: null },
      },
    },
    {
      tableName: 'auto_automations',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Automation.associate = (models) => {
    Automation.hasMany(models.AutomationLog, {
      foreignKey: 'automation_id',
      as: 'logs',
    });
  };

  return Automation;
};
