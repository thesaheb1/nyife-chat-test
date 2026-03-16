'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Coupon = sequelize.define(
    'Coupon',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      discount_type: {
        type: DataTypes.ENUM('percentage', 'fixed'),
        allowNull: false,
      },
      discount_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      max_uses: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      used_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      min_plan_price: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      applicable_plan_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      applicable_user_ids: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      valid_from: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      valid_until: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'sub_coupons',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Coupon.associate = (models) => {
    Coupon.hasMany(models.Subscription, {
      foreignKey: 'coupon_id',
      as: 'subscriptions',
    });
  };

  return Coupon;
};
