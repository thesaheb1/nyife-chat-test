'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('camp_campaigns', 'template_bindings', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Runtime template input bindings for variables and media headers.',
      after: 'variables_mapping',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('camp_campaigns', 'template_bindings');
  },
};
