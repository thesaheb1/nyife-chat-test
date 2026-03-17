'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('support_ticket_reads', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'support_tickets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      actor_type: {
        type: Sequelize.ENUM('user', 'admin'),
        allowNull: false,
      },
      last_read_message_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      last_read_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('support_ticket_reads', ['ticket_id'], {
      name: 'idx_support_ticket_reads_ticket_id',
    });

    await queryInterface.addIndex('support_ticket_reads', ['actor_id', 'actor_type'], {
      name: 'idx_support_ticket_reads_actor_scope',
    });

    await queryInterface.addIndex('support_ticket_reads', ['ticket_id', 'actor_id', 'actor_type'], {
      name: 'uniq_support_ticket_reads_ticket_actor',
      unique: true,
    });

    await queryInterface.sequelize.query(`
      INSERT INTO support_ticket_reads (
        id,
        ticket_id,
        actor_id,
        actor_type,
        last_read_message_id,
        last_read_at,
        created_at,
        updated_at
      )
      SELECT
        UUID(),
        ticket.id,
        ticket.user_id,
        'user',
        (
          SELECT reply.id
          FROM support_ticket_replies AS reply
          WHERE reply.ticket_id = ticket.id
            AND reply.message_kind = 'root'
          ORDER BY reply.created_at ASC, reply.id ASC
          LIMIT 1
        ),
        ticket.created_at,
        ticket.created_at,
        ticket.created_at
      FROM support_tickets AS ticket
      WHERE NOT EXISTS (
        SELECT 1
        FROM support_ticket_reads AS read_state
        WHERE read_state.ticket_id = ticket.id
          AND read_state.actor_id = ticket.user_id
          AND read_state.actor_type = 'user'
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('support_ticket_reads');
  },
};
