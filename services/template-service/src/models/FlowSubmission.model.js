'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FlowSubmission = sequelize.define(
    'FlowSubmission',
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
      flow_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      meta_flow_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      contact_phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      contact_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      wa_account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      flow_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      screen_id: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      submission_data: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      raw_payload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      automation_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'stored',
      },
    },
    {
      tableName: 'tmpl_flow_submissions',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  FlowSubmission.associate = (models) => {
    FlowSubmission.belongsTo(models.Flow, {
      foreignKey: 'flow_id',
      as: 'flow',
    });
  };

  return FlowSubmission;
};
