'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('support-service');

const Ticket = require('./Ticket.model')(sequelize);
const TicketReply = require('./TicketReply.model')(sequelize);
const TicketRead = require('./TicketRead.model')(sequelize);

// Set up associations
const models = { Ticket, TicketReply, TicketRead };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Ticket,
  TicketReply,
  TicketRead,
};
