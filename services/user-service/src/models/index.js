'use strict';

const { createDatabase } = require('@nyife/shared-config');

// ---------------------------------------------------------------------------
// Initialize Sequelize connection for the user-service
// ---------------------------------------------------------------------------
const sequelize = createDatabase('user-service');

// ---------------------------------------------------------------------------
// Import model definitions
// ---------------------------------------------------------------------------
const UserSettings = require('./UserSettings.model')(sequelize);
const UserApiToken = require('./UserApiToken.model')(sequelize);

// ---------------------------------------------------------------------------
// Collect all models for association registration
// ---------------------------------------------------------------------------
const models = {
  UserSettings,
  UserApiToken,
};

// ---------------------------------------------------------------------------
// Run associate() on each model that defines associations
// ---------------------------------------------------------------------------
Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  UserSettings,
  UserApiToken,
};
