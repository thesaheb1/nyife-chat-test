'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sub_plans', 'service_message_price', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('sub_plans', 'referral_conversion_message_price', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.sequelize.query(`
      UPDATE sub_plans
      SET service_message_price = COALESCE(utility_message_price, 0),
          referral_conversion_message_price = 0
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('sub_plans', 'referral_conversion_message_price');
    await queryInterface.removeColumn('sub_plans', 'service_message_price');
  },
};
