'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MediaFile = sequelize.define(
    'MediaFile',
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
      original_name: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      stored_name: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      mime_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      size: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      path: {
        type: DataTypes.STRING(1000),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('image', 'video', 'audio', 'document', 'other'),
        allowNull: false,
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      whatsapp_media_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: 'media_files',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  return MediaFile;
};
