'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Campaign = sequelize.define(
    'Campaign',
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
      template_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      type: {
        type: DataTypes.ENUM('immediate', 'scheduled'),
        allowNull: false,
        defaultValue: 'immediate',
      },
      target_type: {
        type: DataTypes.ENUM('group', 'contacts', 'tags', 'all'),
        allowNull: false,
      },
      target_config: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      variables_mapping: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      template_bindings: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      scheduled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      total_recipients: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sent_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      delivered_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      read_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pending_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      estimated_cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      actual_cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error_summary: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'camp_campaigns',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Campaign.associate = (models) => {
    Campaign.hasMany(models.CampaignMessage, {
      foreignKey: 'campaign_id',
      as: 'messages',
    });
  };

  return Campaign;
};
