'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('media_files', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Tenant owner',
      },
      original_name: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      stored_name: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'UUID-based filename on disk',
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      size: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'File size in bytes',
      },
      path: {
        type: Sequelize.STRING(1000),
        allowNull: false,
        comment: 'Relative path from uploads root',
      },
      type: {
        type: Sequelize.ENUM('image', 'video', 'audio', 'document', 'other'),
        allowNull: false,
      },
      meta: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Dimensions, duration, etc.',
      },
      whatsapp_media_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Media ID after uploading to Meta',
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

    await queryInterface.addIndex('media_files', ['user_id'], { name: 'idx_media_files_user_id' });
    await queryInterface.addIndex('media_files', ['type'], { name: 'idx_media_files_type' });
    await queryInterface.addIndex('media_files', ['user_id', 'created_at'], { name: 'idx_media_files_user_created' });
    await queryInterface.addIndex('media_files', ['whatsapp_media_id'], { name: 'idx_media_files_wa_media_id' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media_files');
  },
};
