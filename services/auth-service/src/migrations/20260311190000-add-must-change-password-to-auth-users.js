'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('auth_users');

    if (!table.must_change_password) {
      await queryInterface.addColumn('auth_users', 'must_change_password', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        after: 'password',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('auth_users');

    if (table.must_change_password) {
      await queryInterface.removeColumn('auth_users', 'must_change_password');
    }
  },
};
