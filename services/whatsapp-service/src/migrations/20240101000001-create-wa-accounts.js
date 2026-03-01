'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wa_accounts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant user ID from auth_users',
      },
      waba_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Meta WhatsApp Business Account ID',
      },
      phone_number_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Meta phone number ID',
      },
      display_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Human-readable phone number',
      },
      verified_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Verified business name',
      },
      business_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Meta Business ID',
      },
      access_token: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Encrypted AES-256 access token',
      },
      quality_rating: {
        type: Sequelize.ENUM('GREEN', 'YELLOW', 'RED'),
        allowNull: true,
        comment: 'Phone number quality rating from Meta',
      },
      messaging_limit: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Current messaging limit tier',
      },
      platform_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Platform type (e.g., CLOUD_API)',
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'restricted', 'banned'),
        allowNull: false,
        defaultValue: 'active',
      },
      webhook_secret: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Per-account webhook secret for signature verification',
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

    // Unique constraint: one phone number per user
    await queryInterface.addConstraint('wa_accounts', {
      fields: ['user_id', 'phone_number_id'],
      type: 'unique',
      name: 'uq_wa_accounts_user_phone',
    });

    // Indexes
    await queryInterface.addIndex('wa_accounts', ['user_id'], {
      name: 'idx_wa_accounts_user_id',
    });
    await queryInterface.addIndex('wa_accounts', ['waba_id'], {
      name: 'idx_wa_accounts_waba_id',
    });
    await queryInterface.addIndex('wa_accounts', ['phone_number_id'], {
      name: 'idx_wa_accounts_phone_number_id',
    });
    await queryInterface.addIndex('wa_accounts', ['status'], {
      name: 'idx_wa_accounts_status',
    });
    await queryInterface.addIndex('wa_accounts', ['created_at'], {
      name: 'idx_wa_accounts_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wa_accounts');
  },
};
