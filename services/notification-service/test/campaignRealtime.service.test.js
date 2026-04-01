'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { emitCampaignRealtime } = require('../src/services/campaignRealtime.service');
const {
  resolveCampaignAudienceUserIds,
  __private: { clearAudienceCache },
} = require('../src/services/campaignAudience.service');

afterEach(() => {
  clearAudienceCache();
});

test('resolveCampaignAudienceUserIds returns owner and active team members for an organization', async () => {
  const executedQueries = [];

  const userIds = await resolveCampaignAudienceUserIds(
    {
      organizationId: 'org-1',
    },
    {
      queryFn: async (sql, options) => {
        executedQueries.push({ sql, options });
        return [
          { user_id: 'owner-1' },
          { user_id: 'member-1' },
          { user_id: 'member-1' },
        ];
      },
    }
  );

  assert.equal(executedQueries.length, 1);
  assert.deepEqual(userIds, ['owner-1', 'member-1']);
});

test('resolveCampaignAudienceUserIds falls back to the direct user when no organization is provided', async () => {
  const userIds = await resolveCampaignAudienceUserIds({ userId: 'user-1' });
  assert.deepEqual(userIds, ['user-1']);
});

test('emitCampaignRealtime emits campaign progress and status to every resolved audience room', async () => {
  const emittedEvents = [];
  const namespace = {
    to(room) {
      return {
        emit(event, payload) {
          emittedEvents.push({ room, event, payload });
        },
      };
    },
  };
  const io = {
    of(name) {
      assert.equal(name, '/notifications');
      return namespace;
    },
  };

  const emitted = await emitCampaignRealtime(
    io,
    {
      campaignId: 'campaign-1',
      organizationId: 'org-1',
      messageId: 'wamid-1',
      status: 'sent',
      timestamp: '2026-04-01T10:00:00.000Z',
      stats: {
        total_recipients: 3,
        sent_count: 1,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        pending_count: 2,
        status: 'running',
      },
    },
    {
      queryFn: async () => [
        { user_id: 'owner-1' },
        { user_id: 'member-1' },
      ],
    }
  );

  assert.equal(emitted, true);
  assert.deepEqual(
    emittedEvents.map(({ room, event }) => `${room}:${event}`),
    [
      'user:owner-1:campaign:progress',
      'user:owner-1:campaign:status',
      'user:member-1:campaign:progress',
      'user:member-1:campaign:status',
    ]
  );
  assert.equal(emittedEvents[1].payload.status, 'running');
  assert.equal(emittedEvents[1].payload.message_status, 'sent');
});
