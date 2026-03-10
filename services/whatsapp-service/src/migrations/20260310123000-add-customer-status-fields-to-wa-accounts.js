'use strict';

const TABLE_NAME = 'wa_accounts';

async function describeTable(queryInterface) {
  return queryInterface.describeTable(TABLE_NAME);
}

async function addColumnIfMissing(queryInterface, Sequelize, columnName, definition) {
  const table = await describeTable(queryInterface);
  if (!table[columnName]) {
    await queryInterface.addColumn(TABLE_NAME, columnName, definition);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, Sequelize, 'name_status', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'quality_rating',
    });

    await addColumnIfMissing(queryInterface, Sequelize, 'number_status', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'name_status',
    });

    await addColumnIfMissing(queryInterface, Sequelize, 'code_verification_status', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'number_status',
    });

    await addColumnIfMissing(queryInterface, Sequelize, 'account_review_status', {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: 'code_verification_status',
    });
  },

  async down(queryInterface) {
    const table = await describeTable(queryInterface);

    if (table.account_review_status) {
      await queryInterface.removeColumn(TABLE_NAME, 'account_review_status');
    }

    if (table.code_verification_status) {
      await queryInterface.removeColumn(TABLE_NAME, 'code_verification_status');
    }

    if (table.number_status) {
      await queryInterface.removeColumn(TABLE_NAME, 'number_status');
    }

    if (table.name_status) {
      await queryInterface.removeColumn(TABLE_NAME, 'name_status');
    }
  },
};
