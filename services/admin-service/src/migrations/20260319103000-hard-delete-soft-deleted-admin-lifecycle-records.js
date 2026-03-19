'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM admin_sub_admins
       WHERE deleted_at IS NOT NULL`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM admin_invitations
       WHERE deleted_at IS NOT NULL`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM admin_user_invitations
       WHERE deleted_at IS NOT NULL`
    );
  },

  async down() {
    // irreversible cleanup
  },
};
