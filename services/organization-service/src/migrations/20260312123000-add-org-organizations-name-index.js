'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('org_organizations', ['name'], {
      name: 'idx_org_organizations_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('org_organizations', 'idx_org_organizations_name');
  },
};
