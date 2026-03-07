'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('template-service');

const Template = require('./Template.model')(sequelize);
const Flow = require('./Flow.model')(sequelize);
const FlowSubmission = require('./FlowSubmission.model')(sequelize);

// Set up associations
const models = { Template, Flow, FlowSubmission };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Template,
  Flow,
  FlowSubmission,
};
