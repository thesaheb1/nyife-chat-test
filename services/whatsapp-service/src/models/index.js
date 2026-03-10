'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('whatsapp-service');

const WaAccount = require('./WaAccount.model')(sequelize);
const WaMessage = require('./WaMessage.model')(sequelize);
const WaOnboardingAttempt = require('./WaOnboardingAttempt.model')(sequelize);

// Set up associations
const models = { WaAccount, WaMessage, WaOnboardingAttempt };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  WaAccount,
  WaMessage,
  WaOnboardingAttempt,
};
