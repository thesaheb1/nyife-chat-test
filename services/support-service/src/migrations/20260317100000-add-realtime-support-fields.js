'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('support_tickets', 'last_message_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'assigned_at',
    });

    await queryInterface.addColumn('support_tickets', 'last_message_preview', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'last_message_at',
    });

    await queryInterface.addColumn('support_tickets', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'satisfaction_feedback',
    });

    await queryInterface.addColumn('support_tickets', 'deleted_by', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      after: 'deleted_at',
    });

    await queryInterface.addColumn('support_ticket_replies', 'message_kind', {
      type: Sequelize.ENUM('root', 'reply'),
      allowNull: false,
      defaultValue: 'reply',
      after: 'reply_type',
    });

    await queryInterface.addIndex('support_tickets', ['deleted_at'], {
      name: 'idx_support_tickets_deleted_at',
    });

    await queryInterface.addIndex('support_tickets', ['last_message_at'], {
      name: 'idx_support_tickets_last_message_at',
    });

    await queryInterface.addIndex('support_ticket_replies', ['ticket_id', 'created_at'], {
      name: 'idx_support_ticket_replies_ticket_created_at',
    });

    await queryInterface.sequelize.query(`
      INSERT INTO support_ticket_replies (
        id,
        ticket_id,
        user_id,
        reply_type,
        message_kind,
        body,
        attachments,
        created_at
      )
      SELECT
        UUID(),
        ticket.id,
        ticket.user_id,
        'user',
        'root',
        ticket.description,
        NULL,
        ticket.created_at
      FROM support_tickets AS ticket
      WHERE NOT EXISTS (
        SELECT 1
        FROM support_ticket_replies AS reply
        WHERE reply.ticket_id = ticket.id
          AND reply.message_kind = 'root'
      )
    `);

    await queryInterface.sequelize.query(`
      UPDATE support_tickets AS ticket
      SET
        last_message_at = COALESCE(
          (
            SELECT reply.created_at
            FROM support_ticket_replies AS reply
            WHERE reply.ticket_id = ticket.id
            ORDER BY reply.created_at DESC, reply.id DESC
            LIMIT 1
          ),
          ticket.created_at
        ),
        last_message_preview = COALESCE(
          (
            SELECT LEFT(reply.body, 255)
            FROM support_ticket_replies AS reply
            WHERE reply.ticket_id = ticket.id
            ORDER BY reply.created_at DESC, reply.id DESC
            LIMIT 1
          ),
          LEFT(ticket.description, 255)
        )
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('support_ticket_replies', 'idx_support_ticket_replies_ticket_created_at');
    await queryInterface.removeIndex('support_tickets', 'idx_support_tickets_last_message_at');
    await queryInterface.removeIndex('support_tickets', 'idx_support_tickets_deleted_at');

    await queryInterface.removeColumn('support_ticket_replies', 'message_kind');
    await queryInterface.removeColumn('support_tickets', 'deleted_by');
    await queryInterface.removeColumn('support_tickets', 'deleted_at');
    await queryInterface.removeColumn('support_tickets', 'last_message_preview');
    await queryInterface.removeColumn('support_tickets', 'last_message_at');
  },
};
