'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('subscription-service');

const Plan = require('./Plan.model')(sequelize);
const Coupon = require('./Coupon.model')(sequelize);
const Subscription = require('./Subscription.model')(sequelize);

const models = { Plan, Coupon, Subscription };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Plan,
  Coupon,
  Subscription,
};
