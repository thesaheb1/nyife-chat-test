'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DailyStat = sequelize.define(
    'DailyStat',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        comment: 'Tenant user ID. NULL for system-wide aggregate stats.',
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      metric: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      value: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'analytics_daily_stats',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  return DailyStat;
};
