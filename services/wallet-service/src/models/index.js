'use strict';

const { createDatabase } = require('@nyife/shared-config');

const sequelize = createDatabase('wallet-service');

const Wallet = require('./Wallet.model')(sequelize);
const Transaction = require('./Transaction.model')(sequelize);
const Invoice = require('./Invoice.model')(sequelize);

// Set up associations
const models = { Wallet, Transaction, Invoice };
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  sequelize,
  Wallet,
  Transaction,
  Invoice,
};
