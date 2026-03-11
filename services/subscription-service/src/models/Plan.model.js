'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Plan = sequelize.define(
    'Plan',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('monthly', 'yearly', 'lifetime'),
        allowNull: false,
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
      max_contacts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_templates: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_campaigns_per_month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_messages_per_month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_team_members: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_organizations: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      max_whatsapp_numbers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      has_priority_support: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      marketing_message_price: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      utility_message_price: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      auth_message_price: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      features: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'sub_plans',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Plan.associate = (models) => {
    Plan.hasMany(models.Subscription, {
      foreignKey: 'plan_id',
      as: 'subscriptions',
    });
  };

  return Plan;
};
