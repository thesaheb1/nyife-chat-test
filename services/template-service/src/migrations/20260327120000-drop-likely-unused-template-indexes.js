'use strict';

/** @type {import('sequelize-cli').Migration} */
const TABLE_NAME = 'tmpl_templates';
const INDEXES = [
  {
    name: 'idx_tmpl_templates_source',
    columns: ['source'],
  },
  {
    name: 'idx_tmpl_templates_meta_status_raw',
    columns: ['meta_status_raw'],
  },
  {
    name: 'idx_tmpl_templates_quality_score',
    columns: ['quality_score'],
  },
];

module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex(TABLE_NAME);
    const indexNames = new Set(indexes.map((index) => index.name));

    for (const index of INDEXES) {
      if (indexNames.has(index.name)) {
        await queryInterface.removeIndex(TABLE_NAME, index.name);
      }
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex(TABLE_NAME);
    const indexNames = new Set(indexes.map((index) => index.name));

    for (const index of INDEXES) {
      if (!indexNames.has(index.name)) {
        await queryInterface.addIndex(TABLE_NAME, index.columns, {
          name: index.name,
        });
      }
    }
  },
};
