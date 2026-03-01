'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('chat-service');

const Conversation = require('./Conversation.model')(sequelize);
const ChatMessage = require('./ChatMessage.model')(sequelize);

// Set up associations
const models = { Conversation, ChatMessage };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Conversation,
  ChatMessage,
};
