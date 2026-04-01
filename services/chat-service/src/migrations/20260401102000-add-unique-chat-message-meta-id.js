'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE duplicate_messages
      FROM chat_messages AS duplicate_messages
      JOIN chat_messages AS retained_messages
        ON duplicate_messages.user_id = retained_messages.user_id
       AND duplicate_messages.meta_message_id = retained_messages.meta_message_id
       AND duplicate_messages.meta_message_id IS NOT NULL
       AND (
         duplicate_messages.created_at > retained_messages.created_at
         OR (
           duplicate_messages.created_at = retained_messages.created_at
           AND duplicate_messages.id > retained_messages.id
         )
       )
    `);

    await queryInterface.addIndex('chat_messages', ['user_id', 'meta_message_id'], {
      name: 'uq_chat_msg_user_meta_id',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('chat_messages', 'uq_chat_msg_user_meta_id');
  },
};
