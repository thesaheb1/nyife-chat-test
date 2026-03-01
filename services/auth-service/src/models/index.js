'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('auth-service');

const User = require('./User.model')(sequelize);
const RefreshToken = require('./RefreshToken.model')(sequelize);

// Set up associations
const models = { User, RefreshToken };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  User,
  RefreshToken,
};
