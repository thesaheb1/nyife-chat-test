'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('analytics_daily_stats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        comment: 'Tenant user ID from auth_users. NULL for system-wide/admin aggregate stats.',
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date for this stat row (YYYY-MM-DD)',
      },
      metric: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Metric name: messages_sent, messages_delivered, messages_read, messages_failed, campaigns_run, campaigns_completed, revenue, new_users, new_contacts, wallet_credits, wallet_debits, inbound_messages',
      },
      value: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
        comment: 'Aggregated metric value',
      },
      meta: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Optional breakdown data or extra context for this stat',
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

    // Unique composite index for upsert logic.
    // Because user_id can be NULL we use a generated column trick or a functional
    // unique index. MySQL 8.0 supports functional indexes but Sequelize CLI does
    // not expose them directly through addIndex, so we use raw SQL.
    // We create a unique index on (COALESCE(user_id, '__SYSTEM__'), date, metric)
    // to ensure uniqueness even when user_id is NULL.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_analytics_daily_stats_unique
      ON analytics_daily_stats ((COALESCE(user_id, '__SYSTEM__')), date, metric)
    `);

    // Standard indexes for query performance
    await queryInterface.addIndex('analytics_daily_stats', ['user_id'], {
      name: 'idx_analytics_daily_stats_user_id',
    });
    await queryInterface.addIndex('analytics_daily_stats', ['date'], {
      name: 'idx_analytics_daily_stats_date',
    });
    await queryInterface.addIndex('analytics_daily_stats', ['metric'], {
      name: 'idx_analytics_daily_stats_metric',
    });
    await queryInterface.addIndex('analytics_daily_stats', ['user_id', 'date'], {
      name: 'idx_analytics_daily_stats_user_id_date',
    });
    await queryInterface.addIndex('analytics_daily_stats', ['user_id', 'date', 'metric'], {
      name: 'idx_analytics_daily_stats_user_id_date_metric',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('analytics_daily_stats');
  },
};
