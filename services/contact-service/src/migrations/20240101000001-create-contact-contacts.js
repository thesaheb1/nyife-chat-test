'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_contacts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant/account owner FK to auth_users',
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'E.164 format phone number',
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      company: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      custom_fields: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      whatsapp_name: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      opted_in: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      opted_in_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_messaged_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      message_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      source: {
        type: Sequelize.ENUM('manual', 'csv_import', 'whatsapp_incoming', 'api'),
        allowNull: false,
        defaultValue: 'manual',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Unique constraint on (user_id, phone) — prevents duplicate contacts per tenant
    await queryInterface.addIndex('contact_contacts', ['user_id', 'phone'], {
      name: 'idx_contact_contacts_user_phone',
      unique: true,
    });

    await queryInterface.addIndex('contact_contacts', ['user_id'], {
      name: 'idx_contact_contacts_user_id',
    });

    await queryInterface.addIndex('contact_contacts', ['phone'], {
      name: 'idx_contact_contacts_phone',
    });

    await queryInterface.addIndex('contact_contacts', ['user_id', 'created_at'], {
      name: 'idx_contact_contacts_user_created',
    });

    await queryInterface.addIndex('contact_contacts', ['source'], {
      name: 'idx_contact_contacts_source',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_contacts');
  },
};
