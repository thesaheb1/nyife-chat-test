'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Flow = sequelize.define(
    'Flow',
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
      meta_flow_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      cloned_from_flow_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      cloned_from_meta_flow_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      categories: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: ['OTHER'],
      },
      status: {
        type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'DEPRECATED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      json_version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '7.1',
      },
      json_definition: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      editor_state: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      data_exchange_config: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      preview_url: {
        type: DataTypes.STRING(1024),
        allowNull: true,
      },
      validation_errors: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      validation_error_details: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
      },
      meta_status: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      meta_health_status: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      can_send_message: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      has_local_changes: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      last_synced_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'tmpl_flows',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Flow.associate = (models) => {
    Flow.hasMany(models.FlowSubmission, {
      foreignKey: 'flow_id',
      as: 'submissions',
    });
    Flow.belongsTo(models.Flow, {
      foreignKey: 'cloned_from_flow_id',
      as: 'cloned_from_flow',
      constraints: false,
    });
  };

  return Flow;
};
