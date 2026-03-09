'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('tmpl_templates');
    const indexes = await queryInterface.showIndex('tmpl_templates');

    if (!table.wa_account_id) {
      await queryInterface.addColumn('tmpl_templates', 'wa_account_id', {
        type: Sequelize.UUID,
        allowNull: true,
        after: 'waba_id',
      });
    }

    if (!indexes.some((index) => index.name === 'idx_tmpl_templates_wa_account_id')) {
      await queryInterface.addIndex('tmpl_templates', ['wa_account_id'], {
        name: 'idx_tmpl_templates_wa_account_id',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE tmpl_templates AS tmpl
      SET tmpl.wa_account_id = (
        SELECT wa.id
        FROM wa_accounts AS wa
        WHERE wa.user_id = tmpl.user_id
          AND wa.waba_id = tmpl.waba_id
          AND wa.status = 'active'
          AND wa.deleted_at IS NULL
        ORDER BY wa.updated_at DESC, wa.created_at DESC
        LIMIT 1
      )
      WHERE tmpl.deleted_at IS NULL
        AND tmpl.waba_id IS NOT NULL
        AND tmpl.wa_account_id IS NULL
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('tmpl_templates');
    const indexes = await queryInterface.showIndex('tmpl_templates');

    if (indexes.some((index) => index.name === 'idx_tmpl_templates_wa_account_id')) {
      await queryInterface.removeIndex('tmpl_templates', 'idx_tmpl_templates_wa_account_id');
    }

    if (table.wa_account_id) {
      await queryInterface.removeColumn('tmpl_templates', 'wa_account_id');
    }
  },
};
