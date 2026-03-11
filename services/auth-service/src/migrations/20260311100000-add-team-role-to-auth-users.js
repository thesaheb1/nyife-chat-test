'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('auth_users', 'role', {
      type: Sequelize.ENUM('user', 'team', 'admin', 'super_admin'),
      allowNull: false,
      defaultValue: 'user',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "UPDATE auth_users SET role = 'user' WHERE role = 'team'"
    );

    await queryInterface.changeColumn('auth_users', 'role', {
      type: Sequelize.ENUM('user', 'admin', 'super_admin'),
      allowNull: false,
      defaultValue: 'user',
    });
  },
};
