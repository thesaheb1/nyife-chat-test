'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('campaign-service');

const Campaign = require('./Campaign.model')(sequelize);
const CampaignMessage = require('./CampaignMessage.model')(sequelize);

// Set up associations
const models = { Campaign, CampaignMessage };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Campaign,
  CampaignMessage,
};
