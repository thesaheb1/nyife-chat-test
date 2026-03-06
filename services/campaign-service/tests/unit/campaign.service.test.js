'use strict';

require('../setup');

const axios = require('axios');
const campaignService = require('../../src/services/campaign.service');
const { Campaign, CampaignMessage } = require('../../src/models');

const USER_ID = 'user-uuid-1';

function makeCampaign(overrides = {}) {
  return {
    id: 'camp-uuid-1',
    user_id: USER_ID,
    wa_account_id: 'wa-uuid-1',
    name: 'Test Campaign',
    template_id: 'tmpl-uuid-1',
    status: 'draft',
    type: 'immediate',
    target_type: 'contacts',
    target_config: { contact_ids: ['c1', 'c2'] },
    variables_mapping: { '1': 'name' },
    estimated_cost: 100,
    total_recipients: 0,
    pending_count: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    update: jest.fn(function (data) { Object.assign(this, data); return this; }),
    reload: jest.fn(),
    destroy: jest.fn(),
    toJSON: jest.fn(function () { return { ...this }; }),
    ...overrides,
  };
}

// Mock axios responses for inter-service calls
function mockServiceCalls() {
  // Subscription limit check
  axios.get.mockImplementation((url) => {
    if (url.includes('check-limit')) {
      return Promise.resolve({ data: { data: { allowed: true, remaining: 99 } } });
    }
    if (url.includes('templates')) {
      return Promise.resolve({ data: { data: { name: 'hello', status: 'APPROVED', language: 'en', components: [] } } });
    }
    if (url.includes('balance')) {
      return Promise.resolve({ data: { data: { balance: 999999 } } });
    }
    if (url.includes('contacts')) {
      return Promise.resolve({ data: { data: { contacts: [
        { id: 'c1', phone: '+911234567890' },
        { id: 'c2', phone: '+919876543210' },
      ] } } });
    }
    return Promise.resolve({ data: {} });
  });
  axios.post.mockResolvedValue({ data: {} });
}

// ─── createCampaign ───────────────────────────────────────────────────────────

describe('createCampaign', () => {
  it('should create draft campaign', async () => {
    mockServiceCalls();
    const camp = makeCampaign();
    Campaign.create.mockResolvedValue(camp);

    const result = await campaignService.createCampaign(USER_ID, {
      name: 'Test', wa_account_id: 'wa-1', template_id: 'tmpl-1',
      target_type: 'contacts', target_config: { contact_ids: ['c1', 'c2'] },
    });

    expect(Campaign.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      user_id: USER_ID,
    }));
    expect(result).toBe(camp);
  });

  it('should throw when subscription limit reached', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('check-limit')) {
        return Promise.resolve({ data: { data: { allowed: false, remaining: 0 } } });
      }
      return Promise.resolve({ data: {} });
    });

    await expect(campaignService.createCampaign(USER_ID, {
      name: 'Test', wa_account_id: 'wa-1', template_id: 'tmpl-1',
      target_type: 'contacts', target_config: { contact_ids: ['c1'] },
    })).rejects.toThrow('Campaign limit reached');
  });

  it('should throw when template not approved', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('check-limit')) {
        return Promise.resolve({ data: { data: { allowed: true, remaining: 99 } } });
      }
      if (url.includes('templates')) {
        return Promise.resolve({ data: { data: { name: 'test', status: 'REJECTED' } } });
      }
      return Promise.resolve({ data: {} });
    });

    await expect(campaignService.createCampaign(USER_ID, {
      name: 'Test', wa_account_id: 'wa-1', template_id: 'tmpl-1',
      target_type: 'contacts', target_config: { contact_ids: ['c1'] },
    })).rejects.toThrow('Template is not approved');
  });
});

// ─── listCampaigns ────────────────────────────────────────────────────────────

describe('listCampaigns', () => {
  it('should return paginated campaigns', async () => {
    const camps = [makeCampaign()];
    Campaign.findAndCountAll.mockResolvedValue({ rows: camps, count: 1 });

    const result = await campaignService.listCampaigns(USER_ID, { page: 1, limit: 20 });

    expect(result.campaigns).toEqual(camps);
    expect(result.meta.total).toBe(1);
  });

  it('should apply status filter', async () => {
    Campaign.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    await campaignService.listCampaigns(USER_ID, { page: 1, limit: 20, status: 'running' });

    expect(Campaign.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user_id: USER_ID, status: 'running' }),
    }));
  });
});

// ─── getCampaign ──────────────────────────────────────────────────────────────

describe('getCampaign', () => {
  it('should return campaign when found', async () => {
    const camp = makeCampaign();
    Campaign.findOne.mockResolvedValue(camp);

    const result = await campaignService.getCampaign(USER_ID, 'camp-uuid-1');
    expect(result).toBe(camp);
  });

  it('should throw notFound when not found', async () => {
    Campaign.findOne.mockResolvedValue(null);

    await expect(campaignService.getCampaign(USER_ID, 'bad'))
      .rejects.toThrow('Campaign not found');
  });
});

// ─── updateCampaign ───────────────────────────────────────────────────────────

describe('updateCampaign', () => {
  it('should update draft campaign', async () => {
    const camp = makeCampaign({ status: 'draft' });
    Campaign.findOne.mockResolvedValue(camp);

    const result = await campaignService.updateCampaign(USER_ID, 'camp-uuid-1', { name: 'New Name' });

    expect(camp.update).toHaveBeenCalledWith({ name: 'New Name' });
    expect(camp.reload).toHaveBeenCalled();
  });

  it('should throw if status !== draft', async () => {
    Campaign.findOne.mockResolvedValue(makeCampaign({ status: 'running' }));

    await expect(campaignService.updateCampaign(USER_ID, 'camp-1', { name: 'X' }))
      .rejects.toThrow('Only draft campaigns can be updated');
  });

  it('should throw notFound', async () => {
    Campaign.findOne.mockResolvedValue(null);

    await expect(campaignService.updateCampaign(USER_ID, 'bad', {}))
      .rejects.toThrow('Campaign not found');
  });
});

// ─── deleteCampaign ───────────────────────────────────────────────────────────

describe('deleteCampaign', () => {
  it('should delete draft campaign', async () => {
    const camp = makeCampaign({ status: 'draft' });
    Campaign.findOne.mockResolvedValue(camp);

    const result = await campaignService.deleteCampaign(USER_ID, 'camp-uuid-1');

    expect(camp.destroy).toHaveBeenCalled();
    expect(result.id).toBe('camp-uuid-1');
  });

  it('should throw if status !== draft', async () => {
    Campaign.findOne.mockResolvedValue(makeCampaign({ status: 'completed' }));

    await expect(campaignService.deleteCampaign(USER_ID, 'camp-1'))
      .rejects.toThrow('Only draft campaigns can be deleted');
  });
});

// ─── startCampaign ────────────────────────────────────────────────────────────

describe('startCampaign', () => {
  it('should start campaign and publish to Kafka', async () => {
    mockServiceCalls();
    const camp = makeCampaign({ status: 'draft' });
    Campaign.findOne.mockResolvedValue(camp);
    CampaignMessage.bulkCreate.mockResolvedValue([]);

    const kafkaProducer = {};
    const { publishEvent } = require('@nyife/shared-events');

    const result = await campaignService.startCampaign(USER_ID, 'camp-uuid-1', kafkaProducer);

    expect(CampaignMessage.bulkCreate).toHaveBeenCalled();
    expect(publishEvent).toHaveBeenCalled();
    expect(camp.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'running',
    }));
  });

  it('should throw if campaign not found', async () => {
    Campaign.findOne.mockResolvedValue(null);

    await expect(campaignService.startCampaign(USER_ID, 'bad', {}))
      .rejects.toThrow('Campaign not found');
  });

  it('should throw if status not draft/scheduled', async () => {
    Campaign.findOne.mockResolvedValue(makeCampaign({ status: 'completed' }));

    await expect(campaignService.startCampaign(USER_ID, 'camp-1', {}))
      .rejects.toThrow('Campaign cannot be started');
  });

  it('should throw if no Kafka producer', async () => {
    Campaign.findOne.mockResolvedValue(makeCampaign({ status: 'draft' }));

    await expect(campaignService.startCampaign(USER_ID, 'camp-1', null))
      .rejects.toThrow('Message broker is not available');
  });
});

// ─── pauseCampaign ────────────────────────────────────────────────────────────

describe('pauseCampaign', () => {
  it('should pause running campaign', async () => {
    const camp = makeCampaign({ status: 'running' });
    Campaign.findOne.mockResolvedValue(camp);

    await campaignService.pauseCampaign(USER_ID, 'camp-1');

    expect(camp.update).toHaveBeenCalledWith({ status: 'paused' });
  });

  it('should throw for invalid status', async () => {
    Campaign.findOne.mockResolvedValue(makeCampaign({ status: 'draft' }));

    await expect(campaignService.pauseCampaign(USER_ID, 'camp-1'))
      .rejects.toThrow('Campaign cannot be paused');
  });
});

// ─── cancelCampaign ───────────────────────────────────────────────────────────

describe('cancelCampaign', () => {
  it('should cancel campaign and update pending messages', async () => {
    const camp = makeCampaign({ status: 'running' });
    Campaign.findOne.mockResolvedValue(camp);
    CampaignMessage.update.mockResolvedValue([5]);

    await campaignService.cancelCampaign(USER_ID, 'camp-1');

    expect(CampaignMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error_message: 'Campaign cancelled' }),
      expect.any(Object)
    );
    expect(camp.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
  });

  it('should throw for invalid status', async () => {
    Campaign.findOne.mockResolvedValue(makeCampaign({ status: 'completed' }));

    await expect(campaignService.cancelCampaign(USER_ID, 'camp-1'))
      .rejects.toThrow('Campaign cannot be cancelled');
  });
});

// ─── handleStatusUpdate ───────────────────────────────────────────────────────

describe('handleStatusUpdate', () => {
  it('should update campaign message status', async () => {
    const msg = {
      id: 'msg-1',
      campaign_id: 'camp-1',
      contact_id: 'c1',
      status: 'pending',
      meta_message_id: null,
      sent_at: null,
      delivered_at: null,
      update: jest.fn(),
    };
    CampaignMessage.findOne.mockResolvedValue(msg);
    const camp = makeCampaign({ status: 'running' });
    Campaign.findByPk.mockResolvedValue(camp);
    Campaign.update.mockResolvedValue([1]);
    CampaignMessage.count.mockResolvedValue(5);

    const result = await campaignService.handleStatusUpdate({
      campaignId: 'camp-1',
      contactId: 'c1',
      status: 'sent',
      timestamp: Date.now(),
    });

    expect(msg.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    expect(Campaign.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should return null when message not found', async () => {
    CampaignMessage.findOne.mockResolvedValue(null);

    const result = await campaignService.handleStatusUpdate({
      campaignId: 'camp-1',
      contactId: 'c1',
      status: 'sent',
    });

    expect(result).toBeNull();
  });
});
