'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('admin-service');

const AdminRole = require('./AdminRole.model')(sequelize);
const SubAdmin = require('./SubAdmin.model')(sequelize);
const AdminInvitation = require('./AdminInvitation.model')(sequelize);
const AdminSetting = require('./AdminSetting.model')(sequelize);

const models = { AdminRole, SubAdmin, AdminInvitation, AdminSetting };

Object.values(models).forEach((model) => {
  if (model.associate) model.associate(models);
});

module.exports = { sequelize, AdminRole, SubAdmin, AdminInvitation, AdminSetting };
