'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('analytics-service');

const DailyStat = require('./DailyStat.model')(sequelize);

const models = { DailyStat };

Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  DailyStat,
};
