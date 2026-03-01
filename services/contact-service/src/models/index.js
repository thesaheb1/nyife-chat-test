'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('contact-service');

const Contact = require('./Contact.model')(sequelize);
const Tag = require('./Tag.model')(sequelize);
const ContactTag = require('./ContactTag.model')(sequelize);
const Group = require('./Group.model')(sequelize);
const GroupMember = require('./GroupMember.model')(sequelize);

const models = { Contact, Tag, ContactTag, Group, GroupMember };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Contact,
  Tag,
  ContactTag,
  Group,
  GroupMember,
};
