'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('tmpl_templates');
    const indexes = await queryInterface.showIndex('tmpl_templates');

    if (!table.meta_status_raw) {
      await queryInterface.addColumn('tmpl_templates', 'meta_status_raw', {
        type: Sequelize.STRING(50),
        allowNull: true,
        after: 'meta_template_id',
      });
    }

    if (!table.quality_score) {
      await queryInterface.addColumn('tmpl_templates', 'quality_score', {
        type: Sequelize.STRING(20),
        allowNull: true,
        after: 'meta_status_raw',
      });
    }

    if (!table.quality_reasons) {
      await queryInterface.addColumn('tmpl_templates', 'quality_reasons', {
        type: Sequelize.JSON,
        allowNull: true,
        after: 'quality_score',
      });
    }

    if (!indexes.some((index) => index.name === 'idx_tmpl_templates_meta_status_raw')) {
      await queryInterface.addIndex('tmpl_templates', ['meta_status_raw'], {
        name: 'idx_tmpl_templates_meta_status_raw',
      });
    }

    if (!indexes.some((index) => index.name === 'idx_tmpl_templates_quality_score')) {
      await queryInterface.addIndex('tmpl_templates', ['quality_score'], {
        name: 'idx_tmpl_templates_quality_score',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE tmpl_templates
      SET meta_status_raw = CASE status
        WHEN 'approved' THEN 'APPROVED'
        WHEN 'rejected' THEN 'REJECTED'
        WHEN 'paused' THEN 'PAUSED'
        WHEN 'disabled' THEN 'DISABLED'
        WHEN 'pending' THEN 'PENDING'
        ELSE NULL
      END
      WHERE deleted_at IS NULL
        AND meta_template_id IS NOT NULL
        AND meta_status_raw IS NULL
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('tmpl_templates');
    const indexes = await queryInterface.showIndex('tmpl_templates');

    if (indexes.some((index) => index.name === 'idx_tmpl_templates_quality_score')) {
      await queryInterface.removeIndex('tmpl_templates', 'idx_tmpl_templates_quality_score');
    }

    if (indexes.some((index) => index.name === 'idx_tmpl_templates_meta_status_raw')) {
      await queryInterface.removeIndex('tmpl_templates', 'idx_tmpl_templates_meta_status_raw');
    }

    if (table.quality_reasons) {
      await queryInterface.removeColumn('tmpl_templates', 'quality_reasons');
    }

    if (table.quality_score) {
      await queryInterface.removeColumn('tmpl_templates', 'quality_score');
    }

    if (table.meta_status_raw) {
      await queryInterface.removeColumn('tmpl_templates', 'meta_status_raw');
    }
  },
};
