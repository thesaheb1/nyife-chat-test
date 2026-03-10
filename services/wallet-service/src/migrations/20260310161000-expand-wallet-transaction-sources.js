'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE wallet_transactions
      MODIFY COLUMN source ENUM(
        'recharge',
        'message_debit',
        'message_refund',
        'message_adjustment',
        'admin_credit',
        'admin_debit',
        'refund',
        'subscription_payment'
      ) NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE wallet_transactions
      MODIFY COLUMN source ENUM(
        'recharge',
        'message_debit',
        'admin_credit',
        'admin_debit',
        'refund',
        'subscription_payment'
      ) NOT NULL
    `);
  },
};
