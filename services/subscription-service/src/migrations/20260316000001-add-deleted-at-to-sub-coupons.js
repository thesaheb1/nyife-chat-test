'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('sub_coupons');

    if (!table.deleted_at) {
      await queryInterface.addColumn('sub_coupons', 'deleted_at', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'updated_at',
      });
    }

    const indexes = await queryInterface.showIndex('sub_coupons');
    const hasDeletedAtIndex = indexes.some((index) => index.name === 'idx_sub_coupons_deleted_at');

    if (!hasDeletedAtIndex) {
      await queryInterface.addIndex('sub_coupons', ['deleted_at'], {
        name: 'idx_sub_coupons_deleted_at',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('sub_coupons');
    const hasDeletedAtIndex = indexes.some((index) => index.name === 'idx_sub_coupons_deleted_at');

    if (hasDeletedAtIndex) {
      await queryInterface.removeIndex('sub_coupons', 'idx_sub_coupons_deleted_at');
    }

    const table = await queryInterface.describeTable('sub_coupons');
    if (table.deleted_at) {
      await queryInterface.removeColumn('sub_coupons', 'deleted_at');
    }
  },
};
