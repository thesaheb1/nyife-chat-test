'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Template = sequelize.define(
    'Template',
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
      waba_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      wa_account_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(512),
        allowNull: false,
        validate: {
          is: /^[a-z][a-z0-9_]*$/,
        },
      },
      display_name: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      language: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'en_US',
      },
      category: {
        type: DataTypes.ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION'),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('standard', 'authentication', 'carousel', 'flow', 'list_menu'),
        allowNull: false,
        defaultValue: 'standard',
      },
      status: {
        type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      source: {
        type: DataTypes.ENUM('nyife', 'meta_sync'),
        allowNull: true,
      },
      components: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      example_values: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      rejection_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      meta_template_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      last_synced_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'tmpl_templates',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  /**
   * Convert template to a plain object for API responses.
   */
  Template.prototype.toJSON = function () {
    const values = { ...this.get() };
    return values;
  };

  /**
   * Associations. Template has no model-level associations within this service,
   * but the hook allows future expansion.
   */
  Template.associate = () => {
    // No intra-service associations; user_id references auth_users (cross-service).
  };

  return Template;
};
