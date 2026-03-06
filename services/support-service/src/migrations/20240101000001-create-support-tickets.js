'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('support_tickets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      ticket_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      category: {
        type: Sequelize.ENUM('billing', 'technical', 'account', 'whatsapp', 'other'),
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
      },
      status: {
        type: Sequelize.ENUM('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'open',
      },
      assigned_to: {
        type: Sequelize.CHAR(36),
        allowNull: true,
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      satisfaction_rating: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      satisfaction_feedback: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Indexes
    await queryInterface.addIndex('support_tickets', ['user_id'], {
      name: 'idx_support_tickets_user_id',
    });
    await queryInterface.addIndex('support_tickets', ['assigned_to'], {
      name: 'idx_support_tickets_assigned_to',
    });
    await queryInterface.addIndex('support_tickets', ['status'], {
      name: 'idx_support_tickets_status',
    });
    await queryInterface.addIndex('support_tickets', ['category'], {
      name: 'idx_support_tickets_category',
    });
    await queryInterface.addIndex('support_tickets', ['priority'], {
      name: 'idx_support_tickets_priority',
    });
    await queryInterface.addIndex('support_tickets', ['ticket_number'], {
      name: 'idx_support_tickets_ticket_number',
      unique: true,
    });
    await queryInterface.addIndex('support_tickets', ['created_at'], {
      name: 'idx_support_tickets_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('support_tickets');
  },
};
