'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CampaignMessage = sequelize.define(
    'CampaignMessage',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      campaign_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      contact_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      contact_phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'queued', 'sent', 'delivered', 'read', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      meta_message_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      variables: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      error_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      retry_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      max_retries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
    },
    {
      tableName: 'camp_campaign_messages',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  CampaignMessage.associate = (models) => {
    CampaignMessage.belongsTo(models.Campaign, {
      foreignKey: 'campaign_id',
      as: 'campaign',
    });
  };

  return CampaignMessage;
};
