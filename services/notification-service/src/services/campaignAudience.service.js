'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const AUDIENCE_CACHE_TTL_MS = 30 * 1000;
const audienceCache = new Map();

function normalizeId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function loadOrganizationAudienceUserIds(organizationId, queryFn = sequelize.query.bind(sequelize)) {
  const rows = await queryFn(
    `SELECT DISTINCT audience.user_id
     FROM (
       SELECT user_id
       FROM org_organizations
       WHERE id = :organizationId
         AND status = 'active'
         AND deleted_at IS NULL
       UNION
       SELECT member_user_id AS user_id
       FROM org_team_members
       WHERE organization_id = :organizationId
         AND status = 'active'
         AND deleted_at IS NULL
     ) AS audience
     WHERE audience.user_id IS NOT NULL`,
    {
      replacements: { organizationId },
      type: QueryTypes.SELECT,
    }
  );

  return [...new Set(rows.map((row) => normalizeId(row.user_id)).filter(Boolean))];
}

async function resolveCampaignAudienceUserIds(
  payload,
  {
    now = Date.now,
    queryFn = sequelize.query.bind(sequelize),
  } = {}
) {
  const directUserId = normalizeId(payload?.userId);
  const organizationId = normalizeId(payload?.organizationId);

  if (!organizationId) {
    return directUserId ? [directUserId] : [];
  }

  const cacheKey = organizationId;
  const cached = audienceCache.get(cacheKey);
  if (cached && cached.expiresAt > now()) {
    return directUserId && !cached.userIds.includes(directUserId)
      ? [...cached.userIds, directUserId]
      : [...cached.userIds];
  }

  const resolvedIds = await loadOrganizationAudienceUserIds(organizationId, queryFn);
  const userIds = directUserId && !resolvedIds.includes(directUserId)
    ? [...resolvedIds, directUserId]
    : resolvedIds;

  audienceCache.set(cacheKey, {
    userIds,
    expiresAt: now() + AUDIENCE_CACHE_TTL_MS,
  });

  return [...userIds];
}

function clearAudienceCache() {
  audienceCache.clear();
}

module.exports = {
  resolveCampaignAudienceUserIds,
  __private: {
    AUDIENCE_CACHE_TTL_MS,
    loadOrganizationAudienceUserIds,
    clearAudienceCache,
  },
};
