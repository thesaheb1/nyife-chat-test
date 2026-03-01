'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('automation-service');

const Automation = require('./Automation.model')(sequelize);
const AutomationLog = require('./AutomationLog.model')(sequelize);
const Webhook = require('./Webhook.model')(sequelize);

// Set up associations
const models = { Automation, AutomationLog, Webhook };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Automation,
  AutomationLog,
  Webhook,
};
