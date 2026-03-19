'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DELETE oi
         FROM org_invitations AS oi
         INNER JOIN org_organizations AS o
           ON o.id = oi.organization_id
         INNER JOIN auth_users AS u
           ON u.id = o.user_id
         WHERE u.role = 'user'
           AND u.deleted_at IS NOT NULL`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `DELETE FROM auth_users
         WHERE role = 'user'
           AND deleted_at IS NOT NULL`,
        { transaction }
      );
    });
  },

  async down() {
    // irreversible cleanup
  },
};
