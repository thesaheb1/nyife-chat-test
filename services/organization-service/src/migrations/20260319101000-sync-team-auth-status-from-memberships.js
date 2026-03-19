'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE auth_users AS user
       SET user.status = CASE
         WHEN EXISTS (
           SELECT 1
           FROM org_team_members AS member
           WHERE member.member_user_id = user.id
             AND member.status = 'active'
             AND member.deleted_at IS NULL
         ) THEN 'active'
         ELSE 'inactive'
       END,
       user.updated_at = NOW()
       WHERE user.role = 'team'
         AND user.deleted_at IS NULL
         AND user.status IN ('active', 'inactive')`
    );

    await queryInterface.sequelize.query(
      `UPDATE auth_refresh_tokens AS token
       INNER JOIN auth_users AS user
         ON user.id = token.user_id
       SET token.is_revoked = true,
           token.updated_at = NOW()
       WHERE user.role = 'team'
         AND user.status = 'inactive'
         AND token.is_revoked = false`
    );
  },

  async down() {
    // Irreversible data repair migration.
  },
};
