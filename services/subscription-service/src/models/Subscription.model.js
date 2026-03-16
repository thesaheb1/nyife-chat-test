'use strict';

const { DataTypes } = require('sequelize');

const DEFAULT_USAGE = {
  contacts_used: 0,
  templates_used: 0,
  campaigns_this_month: 0,
  messages_this_month: 0,
  team_members_used: 0,
  organizations_used: 0,
  whatsapp_numbers_used: 0,
};

module.exports = (sequelize) => {
  const Subscription = sequelize.define(
    'Subscription',
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
      plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'expired', 'cancelled', 'pending'),
        allowNull: false,
        defaultValue: 'pending',
      },
      starts_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payment_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      payment_method: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      amount_paid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      discount_amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      tax_amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      coupon_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      auto_renew: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      renewal_state: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      grace_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      next_renewal_attempt_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      renewal_attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      last_renewal_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      replaces_subscription_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      usage: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: DEFAULT_USAGE,
        get() {
          const raw = this.getDataValue('usage');
          return { ...DEFAULT_USAGE, ...(raw || {}) };
        },
      },
    },
    {
      tableName: 'sub_subscriptions',
      timestamps: true,
      underscored: true,
      paranoid: false,
    }
  );

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.Plan, {
      foreignKey: 'plan_id',
      as: 'plan',
    });
    Subscription.belongsTo(models.Coupon, {
      foreignKey: 'coupon_id',
      as: 'coupon',
    });
    Subscription.belongsTo(models.Subscription, {
      foreignKey: 'replaces_subscription_id',
      as: 'replacedSubscription',
    });
    Subscription.hasMany(models.Subscription, {
      foreignKey: 'replaces_subscription_id',
      as: 'replacementSubscriptions',
    });
    Subscription.hasMany(models.SubscriptionRenewalAttempt, {
      foreignKey: 'subscription_id',
      as: 'renewalAttempts',
    });
  };

  return Subscription;
};
