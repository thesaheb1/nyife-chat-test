'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tmpl_flows', 'cloned_from_flow_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await queryInterface.addColumn('tmpl_flows', 'cloned_from_meta_flow_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn('tmpl_flows', 'validation_error_details', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    });

    await queryInterface.addColumn('tmpl_flows', 'meta_status', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });

    await queryInterface.addColumn('tmpl_flows', 'meta_health_status', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.addColumn('tmpl_flows', 'can_send_message', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    await queryInterface.addIndex('tmpl_flows', ['cloned_from_flow_id'], {
      name: 'idx_tmpl_flows_cloned_from_flow_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('tmpl_flows', 'idx_tmpl_flows_cloned_from_flow_id');
    await queryInterface.removeColumn('tmpl_flows', 'can_send_message');
    await queryInterface.removeColumn('tmpl_flows', 'meta_health_status');
    await queryInterface.removeColumn('tmpl_flows', 'meta_status');
    await queryInterface.removeColumn('tmpl_flows', 'validation_error_details');
    await queryInterface.removeColumn('tmpl_flows', 'cloned_from_meta_flow_id');
    await queryInterface.removeColumn('tmpl_flows', 'cloned_from_flow_id');
  },
};
