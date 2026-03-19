'use strict';

module.exports = {
  async up(queryInterface) {
    try {
      await queryInterface.sequelize.query(
        `UPDATE support_tickets AS ticket
         INNER JOIN auth_users AS user
           ON user.id = ticket.assigned_to
         LEFT JOIN admin_sub_admins AS sub_admin
           ON sub_admin.user_id = user.id
          AND sub_admin.deleted_at IS NULL
         SET ticket.assigned_to = NULL,
             ticket.assigned_at = NULL,
             ticket.status = CASE
               WHEN ticket.status = 'in_progress' THEN 'open'
               ELSE ticket.status
             END,
             ticket.updated_at = NOW()
         WHERE ticket.assigned_to IS NOT NULL
           AND ticket.deleted_at IS NULL
           AND user.role = 'admin'
           AND (user.status = 'inactive' OR user.deleted_at IS NOT NULL)
           AND sub_admin.id IS NULL`
      );
    } catch (error) {
      const code = error?.original?.code || error?.parent?.code || error?.code;
      const message = error?.original?.sqlMessage || error?.message || '';

      if (code !== 'ER_NO_SUCH_TABLE' && code !== '42S02' && !/doesn't exist/i.test(message)) {
        throw error;
      }
    }

    await queryInterface.sequelize.query(
      `DELETE user
       FROM auth_users AS user
       LEFT JOIN admin_sub_admins AS sub_admin
         ON sub_admin.user_id = user.id
        AND sub_admin.deleted_at IS NULL
       WHERE user.role = 'admin'
         AND (user.status = 'inactive' OR user.deleted_at IS NOT NULL)
         AND sub_admin.id IS NULL`
    );

    await queryInterface.sequelize.query(
      `UPDATE auth_users AS user
       INNER JOIN admin_sub_admins AS sub_admin
         ON sub_admin.user_id = user.id
        AND sub_admin.deleted_at IS NULL
       SET user.status = 'inactive',
           user.updated_at = NOW()
       WHERE user.role = 'admin'
         AND user.deleted_at IS NULL
         AND sub_admin.status = 'inactive'
         AND user.status <> 'inactive'`
    );
  },

  async down() {
    // Irreversible data repair migration.
  },
};
