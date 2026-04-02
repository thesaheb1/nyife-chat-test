'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const campaignService = require('../src/services/campaign.service');
const { Campaign, CampaignMessage } = require('../src/models');

const originalCampaignFindByPk = Campaign.findByPk;
const originalCampaignUpdate = Campaign.update;
const originalCampaignMessageFindOne = CampaignMessage.findOne;
const originalCampaignMessageCount = CampaignMessage.count;

afterEach(() => {
  Campaign.findByPk = originalCampaignFindByPk;
  Campaign.update = originalCampaignUpdate;
  CampaignMessage.findOne = originalCampaignMessageFindOne;
  CampaignMessage.count = originalCampaignMessageCount;
});

test('handleStatusUpdate completes a running single-recipient campaign after immediate sent status', async () => {
  const campaignMessage = {
    campaign_id: 'campaign-1',
    contact_id: 'contact-1',
    meta_message_id: null,
    status: 'pending',
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };

  const campaign = {
    id: 'campaign-1',
    user_id: 'org-1',
    status: 'running',
    pending_count: 1,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    async reload() {
      return this;
    },
  };

  CampaignMessage.findOne = async ({ where }) => {
    if (where.campaign_id === 'campaign-1' && where.contact_id === 'contact-1') {
      return campaignMessage;
    }

    return null;
  };

  Campaign.findByPk = async () => campaign;
  CampaignMessage.count = async () => 0;
  Campaign.update = async (values) => {
    if (values.status === 'completed') {
      campaign.status = 'completed';
      campaign.pending_count = 0;
    }

    return [1];
  };

  const result = await campaignService.handleStatusUpdate({
    campaignId: 'campaign-1',
    contactId: 'contact-1',
    messageId: 'wamid-1',
    status: 'sent',
    timestamp: '2026-04-01T10:00:00.000Z',
  });

  assert.equal(campaignMessage.status, 'sent');
  assert.equal(campaignMessage.meta_message_id, 'wamid-1');
  assert.equal(campaign.status, 'completed');
  assert.equal(result.organizationId, 'org-1');
  assert.equal(result.stats.status, 'completed');
  assert.equal(result.stats.pending_count, 0);
});

test('handleStatusUpdate keeps pending_count intact when a pending message becomes queued', async () => {
  const campaignMessage = {
    campaign_id: 'campaign-queued',
    contact_id: 'contact-queued',
    meta_message_id: null,
    status: 'pending',
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };

  const campaign = {
    id: 'campaign-queued',
    user_id: 'org-1',
    status: 'running',
    pending_count: 1,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    async reload() {
      return this;
    },
  };

  CampaignMessage.findOne = async ({ where }) => {
    if (where.campaign_id === 'campaign-queued' && where.contact_id === 'contact-queued') {
      return campaignMessage;
    }

    return null;
  };

  Campaign.findByPk = async () => campaign;
  CampaignMessage.count = async () => 1;
  Campaign.update = async (values) => {
    if (values.pending_count) {
      campaign.pending_count = 1;
    }

    return [1];
  };

  const result = await campaignService.handleStatusUpdate({
    campaignId: 'campaign-queued',
    contactId: 'contact-queued',
    messageId: 'wamid-queued',
    status: 'queued',
    timestamp: '2026-04-01T10:00:00.000Z',
  });

  assert.equal(campaignMessage.status, 'queued');
  assert.equal(campaign.status, 'running');
  assert.equal(campaign.pending_count, 1);
  assert.equal(result.organizationId, 'org-1');
  assert.equal(result.stats.status, 'running');
  assert.equal(result.stats.pending_count, 1);
});

test('handleStatusUpdate marks the campaign failed when the final unresolved message fails', async () => {
  const campaignMessage = {
    campaign_id: 'campaign-failed',
    contact_id: 'contact-failed',
    meta_message_id: 'wamid-failed',
    status: 'queued',
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };

  const campaign = {
    id: 'campaign-failed',
    user_id: 'org-1',
    status: 'running',
    pending_count: 1,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    async reload() {
      return this;
    },
  };

  CampaignMessage.findOne = async ({ where }) => {
    if (where.campaign_id === 'campaign-failed' && where.contact_id === 'contact-failed') {
      return campaignMessage;
    }

    return null;
  };

  let countCall = 0;
  Campaign.findByPk = async () => campaign;
  CampaignMessage.count = async () => {
    countCall += 1;
    return countCall === 1 ? 0 : 1;
  };
  Campaign.update = async (values) => {
    if (values.status === 'failed') {
      campaign.status = 'failed';
      campaign.pending_count = 0;
      campaign.failed_count = 1;
    }

    return [1];
  };

  const result = await campaignService.handleStatusUpdate({
    campaignId: 'campaign-failed',
    contactId: 'contact-failed',
    messageId: 'wamid-failed',
    status: 'failed',
    timestamp: '2026-04-01T10:00:00.000Z',
    errorMessage: 'Meta rejected the message',
  });

  assert.equal(campaignMessage.status, 'failed');
  assert.equal(campaign.status, 'failed');
  assert.equal(result.stats.status, 'failed');
  assert.equal(result.stats.pending_count, 0);
});

test('handleStatusUpdate can complete a paused campaign when the final in-flight message finishes', async () => {
  const campaignMessage = {
    campaign_id: 'campaign-paused-final',
    contact_id: 'contact-paused-final',
    meta_message_id: 'wamid-paused-final',
    status: 'sent',
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };

  const campaign = {
    id: 'campaign-paused-final',
    user_id: 'org-1',
    status: 'paused',
    pending_count: 1,
    sent_count: 1,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    async reload() {
      return this;
    },
  };

  CampaignMessage.findOne = async ({ where }) => {
    if (where.campaign_id === 'campaign-paused-final' && where.contact_id === 'contact-paused-final') {
      return campaignMessage;
    }

    return null;
  };

  let countCall = 0;
  Campaign.findByPk = async () => campaign;
  CampaignMessage.count = async () => {
    countCall += 1;
    return 0;
  };
  Campaign.update = async (values) => {
    if (values.status === 'completed') {
      campaign.status = 'completed';
      campaign.pending_count = 0;
    }

    return [1];
  };

  const result = await campaignService.handleStatusUpdate({
    campaignId: 'campaign-paused-final',
    contactId: 'contact-paused-final',
    messageId: 'wamid-paused-final',
    status: 'delivered',
    timestamp: '2026-04-01T10:00:00.000Z',
  });

  assert.equal(campaignMessage.status, 'delivered');
  assert.equal(campaign.status, 'completed');
  assert.equal(result.stats.status, 'completed');
});
