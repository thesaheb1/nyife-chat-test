'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('tmpl_flows', 'status', {
      type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'THROTTLED', 'BLOCKED', 'DEPRECATED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE tmpl_flows
      SET status = CASE
        WHEN status IN ('THROTTLED', 'BLOCKED') THEN 'PUBLISHED'
        ELSE status
      END
    `);

    await queryInterface.changeColumn('tmpl_flows', 'status', {
      type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'DEPRECATED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    });
  },
};
