'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('media-service');

const MediaFile = require('./MediaFile.model')(sequelize);

const models = { MediaFile };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  MediaFile,
};
