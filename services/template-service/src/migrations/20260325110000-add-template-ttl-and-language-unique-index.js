'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tmpl_templates', 'message_send_ttl_seconds', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    try {
      await queryInterface.removeIndex('tmpl_templates', 'idx_tmpl_templates_user_waba_name');
    } catch (error) {
      if (error?.name !== 'SequelizeUnknownConstraintError') {
        throw error;
      }
    }

    await queryInterface.addIndex('tmpl_templates', ['user_id', 'waba_id', 'name', 'language'], {
      name: 'idx_tmpl_templates_user_waba_name_language',
      unique: true,
      where: { deleted_at: null },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tmpl_templates', 'idx_tmpl_templates_user_waba_name_language');
    await queryInterface.addIndex('tmpl_templates', ['user_id', 'waba_id', 'name'], {
      name: 'idx_tmpl_templates_user_waba_name',
      unique: true,
      where: { deleted_at: null },
    });
    await queryInterface.removeColumn('tmpl_templates', 'message_send_ttl_seconds');
  },
};
