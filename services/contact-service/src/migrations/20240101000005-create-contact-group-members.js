'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_group_members', {
      contact_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'contact_contacts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'contact_groups',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      added_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Composite primary key
    await queryInterface.addConstraint('contact_group_members', {
      fields: ['contact_id', 'group_id'],
      type: 'primary key',
      name: 'pk_contact_group_members',
    });

    await queryInterface.addIndex('contact_group_members', ['contact_id'], {
      name: 'idx_contact_group_members_contact_id',
    });

    await queryInterface.addIndex('contact_group_members', ['group_id'], {
      name: 'idx_contact_group_members_group_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_group_members');
  },
};
