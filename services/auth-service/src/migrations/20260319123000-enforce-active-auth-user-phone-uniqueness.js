'use strict';

async function hasIndex(queryInterface, indexName) {
  const [indexes] = await queryInterface.sequelize.query(
    `SHOW INDEX FROM auth_users WHERE Key_name = :indexName`,
    {
      replacements: { indexName },
    }
  );

  return indexes.length > 0;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE auth_users
       SET phone = NULL
       WHERE phone IS NOT NULL
         AND TRIM(phone) = ''`
    );

    await queryInterface.sequelize.query(
      `UPDATE auth_users
       SET phone = TRIM(phone)
       WHERE phone IS NOT NULL`
    );

    const [duplicates] = await queryInterface.sequelize.query(
      `SELECT phone, COUNT(*) AS duplicate_count
       FROM auth_users
       WHERE phone IS NOT NULL
         AND deleted_at IS NULL
       GROUP BY phone
       HAVING COUNT(*) > 1
       LIMIT 1`
    );

    if (duplicates[0]) {
      throw new Error(
        `Cannot enforce phone uniqueness because duplicate active phone numbers already exist: ${duplicates[0].phone}`
      );
    }

    const table = await queryInterface.describeTable('auth_users');

    if (!table.active_phone) {
      await queryInterface.sequelize.query(
        `ALTER TABLE auth_users
         ADD COLUMN active_phone VARCHAR(20)
         GENERATED ALWAYS AS (
           CASE
             WHEN deleted_at IS NULL THEN phone
             ELSE NULL
           END
         ) STORED`
      );
    }

    if (!(await hasIndex(queryInterface, 'uniq_auth_users_active_phone'))) {
      await queryInterface.addIndex('auth_users', ['active_phone'], {
        name: 'uniq_auth_users_active_phone',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    if (await hasIndex(queryInterface, 'uniq_auth_users_active_phone')) {
      await queryInterface.removeIndex('auth_users', 'uniq_auth_users_active_phone');
    }

    const table = await queryInterface.describeTable('auth_users');
    if (table.active_phone) {
      await queryInterface.removeColumn('auth_users', 'active_phone');
    }
  },
};
