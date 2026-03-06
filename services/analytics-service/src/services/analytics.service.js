'use strict';

const { DailyStat } = require('../models');

// ──────────────────────────────────────────────────────────────────────────────
// Helpers — stat increment
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Increment (or create) a daily stat row for a given user + metric + today.
 *
 * Uses findOne + save / create rather than raw upsert because the unique index
 * includes a COALESCE expression that Sequelize cannot target directly.
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string|null} userId  - NULL for system-wide aggregates
 * @param {string} metric       - Metric name
 * @param {number} incrementValue - Amount to add (default 1)
 * @param {object|null} meta    - Optional metadata
 * @returns {Promise<object>}
 */
async function incrementDailyStat(sequelize, userId, metric, incrementValue = 1, meta = null) {
  const today = new Date().toISOString().slice(0, 10);

  const where = { user_id: userId, date: today, metric };

  const existing = await DailyStat.findOne({ where });

  if (existing) {
    existing.value = parseInt(existing.value, 10) + incrementValue;
    if (meta) {
      existing.meta = meta;
    }
    await existing.save();
    return existing;
  }

  return DailyStat.create({
    user_id: userId,
    date: today,
    metric,
    value: incrementValue,
    meta,
  });
}

/**
 * Increment a real-time Redis counter.
 * Keys are scoped: analytics:{userId}:{metric}:{date} with a 7-day TTL.
 *
 * @param {import('ioredis').Redis|null} redis
 * @param {string|null} userId
 * @param {string} metric
 * @param {number} value
 */
async function incrementRedisCounter(redis, userId, metric, value = 1) {
  if (!redis) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = userId
      ? `analytics:${userId}:${metric}:${today}`
      : `analytics:system:${metric}:${today}`;

    await redis.incrby(key, value);
    await redis.expire(key, 86400 * 7); // 7-day TTL
  } catch (err) {
    // Redis failures should not break the analytics pipeline
    console.error('[analytics-service] Redis counter increment failed:', err.message);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Kafka Event Processors
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Process campaign.analytics events from whatsapp-service.
 * Payload: { campaignId, userId, messageId, status, timestamp, conversationType?, pricingCategory? }
 */
async function processCampaignAnalytics(payload, sequelize, redis) {
  const metric = `messages_${payload.status}`; // messages_sent, messages_delivered, messages_read, messages_failed

  // Per-user stat
  await incrementDailyStat(sequelize, payload.userId, metric);
  // System-wide stat
  await incrementDailyStat(sequelize, null, metric);

  // Redis real-time counters
  await incrementRedisCounter(redis, payload.userId, metric);
  await incrementRedisCounter(redis, null, metric);

  // Track campaigns_run on first "sent" message per campaign
  if (payload.status === 'sent') {
    await incrementRedisCounter(redis, payload.userId, 'campaigns_run');
  }
}

/**
 * Process wallet.transaction events from wallet-service.
 * Payload: { userId, amount, type, description, referenceId?, referenceType? }
 */
async function processWalletTransaction(payload, sequelize, redis) {
  const metric = payload.type === 'credit' ? 'wallet_credits' : 'wallet_debits';

  // Per-user stat
  await incrementDailyStat(sequelize, payload.userId, metric, payload.amount);
  // System-wide stat
  await incrementDailyStat(sequelize, null, metric, payload.amount);

  // Credit → also track as revenue (system-wide only)
  if (payload.type === 'credit') {
    await incrementDailyStat(sequelize, null, 'revenue', payload.amount);
  }

  // Redis real-time counters
  await incrementRedisCounter(redis, payload.userId, metric, payload.amount);
  await incrementRedisCounter(redis, null, metric, payload.amount);
}

/**
 * Process user.events events from auth-service.
 * Payload: { userId, event, data?, timestamp }
 */
async function processUserEvent(payload, sequelize, redis) {
  if (payload.event === 'registered') {
    await incrementDailyStat(sequelize, null, 'new_users');
    await incrementRedisCounter(redis, null, 'new_users');
  }

  if (payload.event === 'verified') {
    await incrementDailyStat(sequelize, null, 'verified_users');
    await incrementRedisCounter(redis, null, 'verified_users');
  }

  if (payload.event === 'login') {
    await incrementDailyStat(sequelize, null, 'user_logins');
    await incrementRedisCounter(redis, null, 'user_logins');
  }
}

/**
 * Process webhook.inbound events from whatsapp-service.
 * Payload: { wabaId, phoneNumberId, event, eventType, timestamp }
 */
async function processWebhookInbound(payload, sequelize, redis) {
  if (payload.eventType === 'message') {
    await incrementDailyStat(sequelize, null, 'inbound_messages');
    await incrementRedisCounter(redis, null, 'inbound_messages');
  }

  if (payload.eventType === 'status') {
    await incrementDailyStat(sequelize, null, 'status_webhooks');
    await incrementRedisCounter(redis, null, 'status_webhooks');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers — safe query execution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Execute a raw SQL query safely. Returns empty results on error
 * (e.g. when the target table does not exist yet).
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @param {string} sql
 * @param {object} options
 * @returns {Promise<Array>}
 */
async function safeQuery(sequelize, sql, options = {}) {
  try {
    const [rows] = await sequelize.query(sql, { ...options, raw: true });
    return rows || [];
  } catch (err) {
    // Table may not exist yet during early development phases
    console.warn('[analytics-service] Safe query failed:', err.message);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Methods — User
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build dashboard data for a specific user (tenant).
 *
 * Queries multiple tables across the shared database via raw SQL.
 * Each query is wrapped in a try-catch so missing tables return sensible defaults.
 *
 * @param {string} userId
 * @param {object} filters - { date_from?, date_to? }
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('ioredis').Redis|null} redis
 * @returns {Promise<object>}
 */
async function getUserDashboard(userId, filters, sequelize, redis) {
  const results = {};

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // ── Contacts ─────────────────────────────────────────────────────────────────
  const contactRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS total FROM contact_contacts WHERE user_id = ? AND deleted_at IS NULL',
    { replacements: [userId] }
  );
  results.contacts = { total: parseInt(contactRows[0]?.total || 0, 10) };

  // ── Groups ───────────────────────────────────────────────────────────────────
  const groupRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS total FROM contact_groups WHERE user_id = ? AND deleted_at IS NULL',
    { replacements: [userId] }
  );
  results.groups = { total: parseInt(groupRows[0]?.total || 0, 10) };

  // ── Templates by status ──────────────────────────────────────────────────────
  const templateRows = await safeQuery(
    sequelize,
    'SELECT status, COUNT(*) AS count FROM tmpl_templates WHERE user_id = ? AND deleted_at IS NULL GROUP BY status',
    { replacements: [userId] }
  );
  results.templates = { total: 0, by_status: {} };
  templateRows.forEach((r) => {
    const count = parseInt(r.count, 10);
    results.templates.total += count;
    results.templates.by_status[r.status] = count;
  });

  // ── Campaigns by status ──────────────────────────────────────────────────────
  const campaignRows = await safeQuery(
    sequelize,
    'SELECT status, COUNT(*) AS count FROM camp_campaigns WHERE user_id = ? AND deleted_at IS NULL GROUP BY status',
    { replacements: [userId] }
  );
  results.campaigns = { total: 0, by_status: {} };
  campaignRows.forEach((r) => {
    const count = parseInt(r.count, 10);
    results.campaigns.total += count;
    results.campaigns.by_status[r.status] = count;
  });

  // ── Messages stats (today / this_week / this_month) ──────────────────────────
  results.messages = {};
  const messageMetrics = ['messages_sent', 'messages_delivered', 'messages_read', 'messages_failed'];

  for (const period of [
    { label: 'today', from: today },
    { label: 'this_week', from: weekAgo },
    { label: 'this_month', from: monthAgo },
  ]) {
    const msgRows = await safeQuery(
      sequelize,
      'SELECT metric, SUM(value) AS total FROM analytics_daily_stats WHERE user_id = ? AND date >= ? AND metric IN (?, ?, ?, ?) GROUP BY metric',
      { replacements: [userId, period.from, ...messageMetrics] }
    );

    const stats = {};
    msgRows.forEach((r) => {
      stats[r.metric] = parseInt(r.total, 10);
    });

    results.messages[period.label] = {
      sent: stats.messages_sent || 0,
      delivered: stats.messages_delivered || 0,
      read: stats.messages_read || 0,
      failed: stats.messages_failed || 0,
    };
  }

  // ── Wallet balance ───────────────────────────────────────────────────────────
  const walletRows = await safeQuery(
    sequelize,
    'SELECT balance FROM wallet_wallets WHERE user_id = ? LIMIT 1',
    { replacements: [userId] }
  );
  results.wallet = { balance: parseInt(walletRows[0]?.balance || 0, 10) };

  // Recent transactions (last 5)
  const txRows = await safeQuery(
    sequelize,
    'SELECT id, type, amount, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    { replacements: [userId] }
  );
  results.wallet.recent_transactions = txRows;

  // ── Active subscription ──────────────────────────────────────────────────────
  const subRows = await safeQuery(
    sequelize,
    `SELECT s.*, p.name AS plan_name, p.type AS plan_type
     FROM sub_subscriptions s
     LEFT JOIN sub_plans p ON s.plan_id = p.id
     WHERE s.user_id = ? AND s.status = 'active'
     ORDER BY s.created_at DESC LIMIT 1`,
    { replacements: [userId] }
  );
  results.subscription = subRows[0] || null;

  // ── Team members ─────────────────────────────────────────────────────────────
  const teamRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS total FROM org_team_members WHERE user_id = ? AND deleted_at IS NULL',
    { replacements: [userId] }
  );
  results.team_members = { total: parseInt(teamRows[0]?.total || 0, 10) };

  // ── Organizations ────────────────────────────────────────────────────────────
  const orgRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS total FROM org_organizations WHERE user_id = ? AND deleted_at IS NULL',
    { replacements: [userId] }
  );
  results.organizations = { total: parseInt(orgRows[0]?.total || 0, 10) };

  // ── WhatsApp accounts ────────────────────────────────────────────────────────
  const waRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS total FROM wa_accounts WHERE user_id = ? AND deleted_at IS NULL',
    { replacements: [userId] }
  );
  results.whatsapp_accounts = { total: parseInt(waRows[0]?.total || 0, 10) };

  // ── Timeline chart: messages per day for last 30 days ────────────────────────
  const timelineRows = await safeQuery(
    sequelize,
    `SELECT date, metric, value
     FROM analytics_daily_stats
     WHERE user_id = ? AND date >= ? AND metric IN ('messages_sent', 'messages_delivered', 'messages_failed')
     ORDER BY date ASC`,
    { replacements: [userId, monthAgo] }
  );
  results.timeline = timelineRows;

  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Methods — Admin
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build dashboard data for admin panel.
 *
 * @param {object} filters - { date_from?, date_to?, user_id? }
 * @param {import('sequelize').Sequelize} sequelize
 * @param {import('ioredis').Redis|null} redis
 * @returns {Promise<object>}
 */
async function getAdminDashboard(filters, sequelize, redis) {
  const results = {};

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

  // ── Revenue ──────────────────────────────────────────────────────────────────
  results.revenue = {};
  for (const period of [
    { label: 'today', from: today },
    { label: 'this_week', from: weekAgo },
    { label: 'this_month', from: monthAgo },
    { label: 'this_year', from: yearAgo },
  ]) {
    const rows = await safeQuery(
      sequelize,
      "SELECT COALESCE(SUM(value), 0) AS total FROM analytics_daily_stats WHERE user_id IS NULL AND date >= ? AND metric = 'revenue'",
      { replacements: [period.from] }
    );
    results.revenue[period.label] = parseInt(rows[0]?.total || 0, 10);
  }

  // Total revenue (all time)
  const totalRevRows = await safeQuery(
    sequelize,
    "SELECT COALESCE(SUM(value), 0) AS total FROM analytics_daily_stats WHERE user_id IS NULL AND metric = 'revenue'",
    {}
  );
  results.revenue.total = parseInt(totalRevRows[0]?.total || 0, 10);

  // ── Users ────────────────────────────────────────────────────────────────────
  const userRows = await safeQuery(
    sequelize,
    "SELECT status, COUNT(*) AS count FROM auth_users WHERE role = 'user' GROUP BY status",
    {}
  );
  results.users = { total: 0, active: 0, inactive: 0, by_status: {} };
  userRows.forEach((r) => {
    const count = parseInt(r.count, 10);
    results.users.total += count;
    results.users.by_status[r.status] = count;
    if (r.status === 'active') results.users.active = count;
    if (r.status === 'inactive') results.users.inactive = count;
  });

  // New users today/week/month from daily_stats
  for (const period of [
    { label: 'new_today', from: today },
    { label: 'new_this_week', from: weekAgo },
    { label: 'new_this_month', from: monthAgo },
  ]) {
    const rows = await safeQuery(
      sequelize,
      "SELECT COALESCE(SUM(value), 0) AS total FROM analytics_daily_stats WHERE user_id IS NULL AND date >= ? AND metric = 'new_users'",
      { replacements: [period.from] }
    );
    results.users[period.label] = parseInt(rows[0]?.total || 0, 10);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────────
  const subRows = await safeQuery(
    sequelize,
    `SELECT p.name AS plan_name, COUNT(s.id) AS count
     FROM sub_subscriptions s
     LEFT JOIN sub_plans p ON s.plan_id = p.id
     WHERE s.status = 'active'
     GROUP BY p.name`,
    {}
  );
  results.subscriptions = { active: 0, by_plan: {} };
  subRows.forEach((r) => {
    const c = parseInt(r.count, 10);
    results.subscriptions.active += c;
    results.subscriptions.by_plan[r.plan_name || 'unknown'] = c;
  });

  // Expiring soon (within 7 days)
  const expiringRows = await safeQuery(
    sequelize,
    "SELECT COUNT(*) AS count FROM sub_subscriptions WHERE status = 'active' AND ends_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)",
    {}
  );
  results.subscriptions.expiring_soon = parseInt(expiringRows[0]?.count || 0, 10);

  // ── Messages across all users ────────────────────────────────────────────────
  const allMsgRows = await safeQuery(
    sequelize,
    "SELECT metric, SUM(value) AS total FROM analytics_daily_stats WHERE user_id IS NULL AND metric IN ('messages_sent', 'messages_delivered', 'messages_read', 'messages_failed') GROUP BY metric",
    {}
  );
  results.messages = {};
  allMsgRows.forEach((r) => {
    results.messages[r.metric.replace('messages_', '')] = parseInt(r.total, 10);
  });

  // ── Templates by status ──────────────────────────────────────────────────────
  const tmplRows = await safeQuery(
    sequelize,
    'SELECT status, COUNT(*) AS count FROM tmpl_templates WHERE deleted_at IS NULL GROUP BY status',
    {}
  );
  results.templates = { total: 0, by_status: {} };
  tmplRows.forEach((r) => {
    const count = parseInt(r.count, 10);
    results.templates.total += count;
    results.templates.by_status[r.status] = count;
  });

  // ── Campaigns by status ──────────────────────────────────────────────────────
  const campRows = await safeQuery(
    sequelize,
    'SELECT status, COUNT(*) AS count FROM camp_campaigns WHERE deleted_at IS NULL GROUP BY status',
    {}
  );
  results.campaigns = { total: 0, by_status: {} };
  campRows.forEach((r) => {
    const count = parseInt(r.count, 10);
    results.campaigns.total += count;
    results.campaigns.by_status[r.status] = count;
  });

  // ── Support stats ────────────────────────────────────────────────────────────
  const openTicketRows = await safeQuery(
    sequelize,
    "SELECT COUNT(*) AS count FROM support_tickets WHERE status IN ('open', 'in_progress')",
    {}
  );
  results.support = { open_tickets: parseInt(openTicketRows[0]?.count || 0, 10) };

  // Avg resolution time (hours between created_at and resolved_at)
  const avgResRows = await safeQuery(
    sequelize,
    'SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) AS avg_hours FROM support_tickets WHERE resolved_at IS NOT NULL',
    {}
  );
  results.support.avg_resolution_hours = parseFloat(avgResRows[0]?.avg_hours || 0).toFixed(1);

  // Satisfaction score
  const satRows = await safeQuery(
    sequelize,
    'SELECT AVG(satisfaction_rating) AS avg_rating FROM support_tickets WHERE satisfaction_rating IS NOT NULL',
    {}
  );
  results.support.avg_satisfaction = parseFloat(satRows[0]?.avg_rating || 0).toFixed(1);

  // ── Finances ─────────────────────────────────────────────────────────────────
  const walletTotalRows = await safeQuery(
    sequelize,
    'SELECT COALESCE(SUM(balance), 0) AS total FROM wallet_wallets',
    {}
  );
  results.finances = { total_wallet_balance: parseInt(walletTotalRows[0]?.total || 0, 10) };

  const txCountRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS count FROM wallet_transactions',
    {}
  );
  results.finances.total_transactions = parseInt(txCountRows[0]?.count || 0, 10);

  // ── WhatsApp accounts total ──────────────────────────────────────────────────
  const waRows = await safeQuery(
    sequelize,
    'SELECT COUNT(*) AS count FROM wa_accounts WHERE deleted_at IS NULL',
    {}
  );
  results.whatsapp_accounts = { total: parseInt(waRows[0]?.count || 0, 10) };

  // ── Charts data ──────────────────────────────────────────────────────────────

  // Revenue timeline (last 30 days)
  const revTimelineRows = await safeQuery(
    sequelize,
    "SELECT date, value FROM analytics_daily_stats WHERE user_id IS NULL AND metric = 'revenue' AND date >= ? ORDER BY date ASC",
    { replacements: [monthAgo] }
  );
  results.charts = { revenue_timeline: revTimelineRows };

  // User growth (last 30 days)
  const userGrowthRows = await safeQuery(
    sequelize,
    "SELECT date, value FROM analytics_daily_stats WHERE user_id IS NULL AND metric = 'new_users' AND date >= ? ORDER BY date ASC",
    { replacements: [monthAgo] }
  );
  results.charts.user_growth = userGrowthRows;

  // Message volume (last 30 days)
  const msgVolumeRows = await safeQuery(
    sequelize,
    "SELECT date, metric, value FROM analytics_daily_stats WHERE user_id IS NULL AND metric IN ('messages_sent', 'messages_delivered', 'messages_failed') AND date >= ? ORDER BY date ASC",
    { replacements: [monthAgo] }
  );
  results.charts.message_volume = msgVolumeRows;

  // Wallet flow (last 30 days)
  const walletFlowRows = await safeQuery(
    sequelize,
    "SELECT date, metric, value FROM analytics_daily_stats WHERE user_id IS NULL AND metric IN ('wallet_credits', 'wallet_debits') AND date >= ? ORDER BY date ASC",
    { replacements: [monthAgo] }
  );
  results.charts.wallet_flow = walletFlowRows;

  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Metrics query — generic
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get specific metrics for a date range, optionally filtered by user.
 *
 * @param {object} params - { metrics, date_from, date_to, user_id? }
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<object>}
 */
async function getMetrics(params, sequelize) {
  const { metrics, date_from, date_to, user_id } = params;

  const placeholders = metrics.map(() => '?').join(', ');
  const replacements = [];

  let sql = `SELECT date, metric, SUM(value) AS total
     FROM analytics_daily_stats
     WHERE date >= ? AND date <= ? AND metric IN (${placeholders})`;

  replacements.push(date_from, date_to, ...metrics);

  if (user_id) {
    sql += ' AND user_id = ?';
    replacements.push(user_id);
  } else {
    sql += ' AND user_id IS NULL';
  }

  sql += ' GROUP BY date, metric ORDER BY date ASC';

  const rows = await safeQuery(sequelize, sql, { replacements });

  // Build structured response: { [metric]: [ { date, value } ] }
  const result = {};
  metrics.forEach((m) => {
    result[m] = [];
  });

  rows.forEach((r) => {
    if (result[r.metric]) {
      result[r.metric].push({ date: r.date, value: parseInt(r.total, 10) });
    }
  });

  // Summary totals
  const summary = {};
  metrics.forEach((m) => {
    summary[m] = result[m].reduce((sum, item) => sum + item.value, 0);
  });

  return { data: result, summary };
}

module.exports = {
  incrementDailyStat,
  incrementRedisCounter,
  processCampaignAnalytics,
  processWalletTransaction,
  processUserEvent,
  processWebhookInbound,
  getUserDashboard,
  getAdminDashboard,
  getMetrics,
};
