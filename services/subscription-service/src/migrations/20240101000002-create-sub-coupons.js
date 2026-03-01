'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sub_coupons', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      discount_type: {
        type: Sequelize.ENUM('percentage', 'fixed'),
        allowNull: false,
      },
      discount_value: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Percentage (0-100) or fixed amount in paise',
      },
      max_uses: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'NULL = unlimited',
      },
      used_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      min_plan_price: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Minimum plan price in paise',
      },
      applicable_plan_ids: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'NULL = all plans',
      },
      applicable_user_ids: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'NULL = all users',
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_active: {
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
    });

    await queryInterface.addIndex('sub_coupons', ['code'], { name: 'idx_sub_coupons_code', unique: true });
    await queryInterface.addIndex('sub_coupons', ['is_active'], { name: 'idx_sub_coupons_is_active' });
    await queryInterface.addIndex('sub_coupons', ['valid_from', 'valid_until'], { name: 'idx_sub_coupons_validity' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sub_coupons');
  },
};
