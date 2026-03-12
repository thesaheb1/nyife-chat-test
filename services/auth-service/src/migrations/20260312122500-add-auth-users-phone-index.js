'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('auth_users', ['phone'], {
      name: 'idx_auth_users_phone',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('auth_users', 'idx_auth_users_phone');
  },
};
