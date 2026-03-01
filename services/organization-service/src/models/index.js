'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('organization-service');

const User = require('./User.model')(sequelize);
const Organization = require('./Organization.model')(sequelize);
const TeamMember = require('./TeamMember.model')(sequelize);

// Set up associations
const models = { User, Organization, TeamMember };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  User,
  Organization,
  TeamMember,
};
