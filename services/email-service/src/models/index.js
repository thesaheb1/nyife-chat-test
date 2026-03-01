'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('email-service');

const Email = require('./Email.model')(sequelize);
const EmailTemplate = require('./EmailTemplate.model')(sequelize);

module.exports = {
  sequelize,
  Email,
  EmailTemplate,
};
