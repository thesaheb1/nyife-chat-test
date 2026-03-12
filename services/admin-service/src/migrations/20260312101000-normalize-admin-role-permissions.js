'use strict';

const {
  normalizeAdminPermissions,
} = require('@nyife/shared-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const roles = await queryInterface.sequelize.query(
      'SELECT id, permissions FROM admin_roles',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    for (const role of roles) {
      const parsedPermissions =
        role.permissions && typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;

      const normalizedPermissions = normalizeAdminPermissions(parsedPermissions, {
        includeReserved: false,
      });

      await queryInterface.sequelize.query(
        'UPDATE admin_roles SET permissions = :permissions, updated_at = :updatedAt WHERE id = :id',
        {
          replacements: {
            id: role.id,
            permissions: JSON.stringify(normalizedPermissions),
            updatedAt: new Date(),
          },
        }
      );
    }
  },

  async down() {
    // No-op: permission normalization is intentionally irreversible.
  },
};
