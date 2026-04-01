'use strict';

const { resolveCampaignAudienceUserIds } = require('./campaignAudience.service');

async function emitCampaignRealtime(io, payload, options = {}) {
  if (!io || !payload?.campaignId) {
    return false;
  }

  const audienceUserIds = await resolveCampaignAudienceUserIds(payload, options);
  if (!audienceUserIds.length) {
    return false;
  }

  const namespace = io.of('/notifications');
  const progressPayload = {
    campaign_id: payload.campaignId,
    message_id: payload.messageId || null,
    message_status: payload.status,
    stats: payload.stats || null,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
  const statusPayload = {
    campaign_id: payload.campaignId,
    message_id: payload.messageId || null,
    message_status: payload.status,
    status: payload.stats?.status || payload.status,
    stats: payload.stats || null,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  for (const userId of audienceUserIds) {
    const room = `user:${userId}`;
    namespace.to(room).emit('campaign:progress', progressPayload);
    namespace.to(room).emit('campaign:status', statusPayload);
  }

  return true;
}

module.exports = {
  emitCampaignRealtime,
};
