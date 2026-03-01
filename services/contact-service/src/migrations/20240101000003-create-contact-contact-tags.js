'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_contact_tags', {
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
      tag_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'contact_tags',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    // Composite primary key
    await queryInterface.addConstraint('contact_contact_tags', {
      fields: ['contact_id', 'tag_id'],
      type: 'primary key',
      name: 'pk_contact_contact_tags',
    });

    await queryInterface.addIndex('contact_contact_tags', ['contact_id'], {
      name: 'idx_contact_contact_tags_contact_id',
    });

    await queryInterface.addIndex('contact_contact_tags', ['tag_id'], {
      name: 'idx_contact_contact_tags_tag_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_contact_tags');
  },
};
