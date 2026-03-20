'use strict';

const TABLE_NAME = 'wa_accounts';
const COLUMN_NAME = 'quality_rating';
const COLUMN_COMMENT = 'Phone number quality rating from Meta';

async function hasQualityRatingColumn(queryInterface) {
  const table = await queryInterface.describeTable(TABLE_NAME);
  return Boolean(table[COLUMN_NAME]);
}

module.exports = {
  async up(queryInterface) {
    if (!(await hasQualityRatingColumn(queryInterface))) {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE \`${TABLE_NAME}\`
      MODIFY \`${COLUMN_NAME}\` ENUM('GREEN', 'YELLOW', 'RED', 'UNKNOWN') NULL
      COMMENT '${COLUMN_COMMENT}'
    `);
  },

  async down(queryInterface) {
    if (!(await hasQualityRatingColumn(queryInterface))) {
      return;
    }

    await queryInterface.sequelize.query(`
      UPDATE \`${TABLE_NAME}\`
      SET \`${COLUMN_NAME}\` = NULL
      WHERE \`${COLUMN_NAME}\` = 'UNKNOWN'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE \`${TABLE_NAME}\`
      MODIFY \`${COLUMN_NAME}\` ENUM('GREEN', 'YELLOW', 'RED') NULL
      COMMENT '${COLUMN_COMMENT}'
    `);
  },
};
