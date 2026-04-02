'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('camp_campaign_messages', ['campaign_id', 'contact_id'], {
      name: 'idx_camp_messages_campaign_id_contact_id',
    });

    await queryInterface.addIndex('camp_campaign_messages', ['campaign_id', 'meta_message_id'], {
      name: 'idx_camp_messages_campaign_id_meta_message_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('camp_campaign_messages', 'idx_camp_messages_campaign_id_contact_id');
    await queryInterface.removeIndex('camp_campaign_messages', 'idx_camp_messages_campaign_id_meta_message_id');
  },
};
