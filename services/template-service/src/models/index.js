'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('template-service');

const Template = require('./Template.model')(sequelize);

// Set up associations
const models = { Template };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Template,
};
