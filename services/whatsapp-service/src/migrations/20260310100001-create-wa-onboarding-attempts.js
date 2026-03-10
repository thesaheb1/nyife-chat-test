'use strict';

const TABLE_NAME = 'wa_onboarding_attempts';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      wa_account_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      signup_session_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      business_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      waba_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      phone_number_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'failed', 'reconcile_pending'),
        allowNull: false,
        defaultValue: 'pending',
      },
      step_details: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      warnings: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      last_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_retryable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex(TABLE_NAME, ['user_id'], {
      name: 'idx_wa_onboarding_attempts_user_id',
    });
    await queryInterface.addIndex(TABLE_NAME, ['wa_account_id'], {
      name: 'idx_wa_onboarding_attempts_wa_account_id',
    });
    await queryInterface.addIndex(TABLE_NAME, ['signup_session_id'], {
      name: 'idx_wa_onboarding_attempts_signup_session_id',
    });
    await queryInterface.addIndex(TABLE_NAME, ['phone_number_id'], {
      name: 'idx_wa_onboarding_attempts_phone_number_id',
    });
    await queryInterface.addIndex(TABLE_NAME, ['status'], {
      name: 'idx_wa_onboarding_attempts_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE_NAME);
  },
};
