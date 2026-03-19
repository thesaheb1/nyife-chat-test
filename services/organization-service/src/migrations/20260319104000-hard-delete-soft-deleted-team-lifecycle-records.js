'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM org_team_members
       WHERE deleted_at IS NOT NULL`
    );

    await queryInterface.sequelize.query(
      `DELETE FROM org_invitations
       WHERE deleted_at IS NOT NULL`
    );
  },

  async down() {
    // irreversible cleanup
  },
};
