'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('support_tickets', 'organization_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      after: 'user_id',
    });

    await queryInterface.sequelize.query(`
      UPDATE support_tickets AS ticket
      INNER JOIN org_organizations AS org
        ON org.id = ticket.user_id
       AND org.deleted_at IS NULL
      SET ticket.organization_id = org.id,
          ticket.user_id = org.user_id
      WHERE ticket.organization_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE support_tickets AS ticket
      INNER JOIN org_organizations AS org
        ON org.user_id = ticket.user_id
       AND org.deleted_at IS NULL
      INNER JOIN (
        SELECT user_id, MIN(created_at) AS created_at
        FROM org_organizations
        WHERE deleted_at IS NULL
        GROUP BY user_id
      ) AS first_org
        ON first_org.user_id = org.user_id
       AND first_org.created_at = org.created_at
      SET ticket.organization_id = org.id
      WHERE ticket.organization_id IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE support_tickets
      SET organization_id = user_id
      WHERE organization_id IS NULL
    `);

    await queryInterface.changeColumn('support_tickets', 'organization_id', {
      type: Sequelize.CHAR(36),
      allowNull: false,
    });

    await queryInterface.addIndex('support_tickets', ['organization_id'], {
      name: 'idx_support_tickets_organization_id',
    });

    await queryInterface.addIndex('support_tickets', ['organization_id', 'created_at'], {
      name: 'idx_support_tickets_organization_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('support_tickets', 'idx_support_tickets_organization_created_at');
    await queryInterface.removeIndex('support_tickets', 'idx_support_tickets_organization_id');
    await queryInterface.removeColumn('support_tickets', 'organization_id');
  },
};
