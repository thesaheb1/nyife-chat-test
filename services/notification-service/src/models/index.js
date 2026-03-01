'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('notification-service');

const Notification = require('./Notification.model')(sequelize);
const AdminBroadcast = require('./AdminBroadcast.model')(sequelize);

module.exports = {
  sequelize,
  Notification,
  AdminBroadcast,
};
