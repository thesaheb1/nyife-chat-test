'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tmpl_templates', 'source', {
      type: Sequelize.ENUM('nyife', 'meta_sync'),
      allowNull: true,
      after: 'status',
    });

    await queryInterface.addIndex('tmpl_templates', ['source'], {
      name: 'idx_tmpl_templates_source',
    });

    await queryInterface.sequelize.query(`
      UPDATE tmpl_templates
      SET source = 'nyife'
      WHERE source IS NULL
        AND meta_template_id IS NULL
        AND deleted_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tmpl_templates', 'idx_tmpl_templates_source');
    await queryInterface.removeColumn('tmpl_templates', 'source');
  },
};
