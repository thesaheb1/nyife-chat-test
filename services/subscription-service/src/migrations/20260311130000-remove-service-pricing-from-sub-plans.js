'use strict';

async function hasColumn(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table[columnName]);
}

module.exports = {
  async up(queryInterface) {
    if (await hasColumn(queryInterface, 'sub_plans', 'referral_conversion_message_price')) {
      await queryInterface.removeColumn('sub_plans', 'referral_conversion_message_price');
    }

    if (await hasColumn(queryInterface, 'sub_plans', 'service_message_price')) {
      await queryInterface.removeColumn('sub_plans', 'service_message_price');
    }
  },

  async down(queryInterface, Sequelize) {
    if (!(await hasColumn(queryInterface, 'sub_plans', 'service_message_price'))) {
      await queryInterface.addColumn('sub_plans', 'service_message_price', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!(await hasColumn(queryInterface, 'sub_plans', 'referral_conversion_message_price'))) {
      await queryInterface.addColumn('sub_plans', 'referral_conversion_message_price', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },
};

