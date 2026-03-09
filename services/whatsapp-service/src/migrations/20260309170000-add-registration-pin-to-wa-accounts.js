'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('wa_accounts');

    if (!table.registration_pin) {
      await queryInterface.addColumn('wa_accounts', 'registration_pin', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Encrypted 6-digit Meta registration PIN managed by Nyife',
        after: 'access_token',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('wa_accounts');

    if (table.registration_pin) {
      await queryInterface.removeColumn('wa_accounts', 'registration_pin');
    }
  },
};
