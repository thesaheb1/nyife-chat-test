'use strict';

require('../setup');

const axios = require('axios');
const automationService = require('../../src/services/automation.service');
const { Automation, AutomationLog, Webhook, sequelize } = require('../../src/models');

const USER_ID = 'user-uuid-1';

function makeAutomation(overrides = {}) {
  return {
    id: 'auto-uuid-1',
    user_id: USER_ID,
    wa_account_id: 'wa-uuid-1',
    name: 'Test Automation',
    type: 'basic_reply',
    status: 'active',
    trigger_config: { trigger_type: 'exact', trigger_value: 'hello' },
    action_config: { message_type: 'text', content: 'Hi there!' },
    priority: 0,
    conditions: null,
    stats: { triggered_count: 0, last_triggered_at: null },
    update: jest.fn(function (data) { Object.assign(this, data); return this; }),
    reload: jest.fn(),
    destroy: jest.fn(),
    toJSON: jest.fn(function () { return { ...this }; }),
    ...overrides,
  };
}

function makeWebhook(overrides = {}) {
  return {
    id: 'wh-uuid-1',
    user_id: USER_ID,
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    events: ['message.received'],
    secret: 'test-secret',
    headers: null,
    is_active: true,
    failure_count: 0,
    last_triggered_at: null,
    update: jest.fn(function (data) { Object.assign(this, data); return this; }),
    reload: jest.fn(),
    destroy: jest.fn(),
    ...overrides,
  };
}

// ─── Automation CRUD ──────────────────────────────────────────────────────────

describe('createAutomation', () => {
  it('should create automation with correct fields', async () => {
    const auto = makeAutomation();
    Automation.create.mockResolvedValue(auto);

    const result = await automationService.createAutomation(USER_ID, {
      wa_account_id: 'wa-1',
      name: 'Test',
      type: 'basic_reply',
      trigger_config: { trigger_type: 'exact', trigger_value: 'hi' },
      action_config: { content: 'Hello!' },
    });

    expect(Automation.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'test-uuid-1234',
      user_id: USER_ID,
      status: 'draft',
    }));
    expect(result).toBe(auto);
  });
});

describe('listAutomations', () => {
  it('should return paginated automations', async () => {
    const autos = [makeAutomation()];
    Automation.findAndCountAll.mockResolvedValue({ rows: autos, count: 1 });

    const result = await automationService.listAutomations(USER_ID, { page: 1, limit: 20 });

    expect(result.automations).toEqual(autos);
    expect(result.meta.total).toBe(1);
  });

  it('should apply filters', async () => {
    Automation.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    await automationService.listAutomations(USER_ID, {
      page: 1, limit: 20, status: 'active', type: 'basic_reply', search: 'test',
    });

    expect(Automation.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user_id: USER_ID,
        status: 'active',
        type: 'basic_reply',
      }),
    }));
  });
});

describe('getAutomation', () => {
  it('should return automation when found', async () => {
    const auto = makeAutomation();
    Automation.findOne.mockResolvedValue(auto);

    const result = await automationService.getAutomation(USER_ID, 'auto-1');
    expect(result).toBe(auto);
  });

  it('should throw notFound when not found', async () => {
    Automation.findOne.mockResolvedValue(null);

    await expect(automationService.getAutomation(USER_ID, 'bad'))
      .rejects.toThrow('Automation not found');
  });
});

describe('updateAutomation', () => {
  it('should update and reload', async () => {
    const auto = makeAutomation();
    Automation.findOne.mockResolvedValue(auto);

    await automationService.updateAutomation(USER_ID, 'auto-1', { name: 'New' });

    expect(auto.update).toHaveBeenCalledWith({ name: 'New' });
    expect(auto.reload).toHaveBeenCalled();
  });

  it('should throw notFound', async () => {
    Automation.findOne.mockResolvedValue(null);

    await expect(automationService.updateAutomation(USER_ID, 'bad', {}))
      .rejects.toThrow('Automation not found');
  });
});

describe('deleteAutomation', () => {
  it('should soft-delete', async () => {
    const auto = makeAutomation();
    Automation.findOne.mockResolvedValue(auto);

    const result = await automationService.deleteAutomation(USER_ID, 'auto-uuid-1');

    expect(auto.destroy).toHaveBeenCalled();
    expect(result.id).toBe('auto-uuid-1');
  });
});

describe('updateAutomationStatus', () => {
  it('should update status', async () => {
    const auto = makeAutomation();
    Automation.findOne.mockResolvedValue(auto);

    await automationService.updateAutomationStatus(USER_ID, 'auto-1', 'inactive');

    expect(auto.update).toHaveBeenCalledWith({ status: 'inactive' });
  });
});

describe('getAutomationLogs', () => {
  it('should return paginated logs', async () => {
    Automation.findOne.mockResolvedValue(makeAutomation());
    AutomationLog.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });

    const result = await automationService.getAutomationLogs(USER_ID, 'auto-1', { page: 1, limit: 20 });

    expect(result.logs).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('should throw notFound if automation not found', async () => {
    Automation.findOne.mockResolvedValue(null);

    await expect(automationService.getAutomationLogs(USER_ID, 'bad', { page: 1, limit: 20 }))
      .rejects.toThrow('Automation not found');
  });
});

// ─── Webhook CRUD ─────────────────────────────────────────────────────────────

describe('createWebhook', () => {
  it('should create webhook', async () => {
    const wh = makeWebhook();
    Webhook.create.mockResolvedValue(wh);

    const result = await automationService.createWebhook(USER_ID, {
      name: 'Test', url: 'https://example.com', events: ['msg'],
    });

    expect(Webhook.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER_ID,
      is_active: true,
    }));
    expect(result).toBe(wh);
  });
});

describe('listWebhooks', () => {
  it('should return paginated webhooks', async () => {
    Webhook.findAndCountAll.mockResolvedValue({ rows: [makeWebhook()], count: 1 });

    const result = await automationService.listWebhooks(USER_ID, { page: 1, limit: 20 });

    expect(result.webhooks).toHaveLength(1);
  });
});

describe('getWebhook', () => {
  it('should return webhook', async () => {
    Webhook.findOne.mockResolvedValue(makeWebhook());

    const result = await automationService.getWebhook(USER_ID, 'wh-1');
    expect(result.name).toBe('Test Webhook');
  });

  it('should throw notFound', async () => {
    Webhook.findOne.mockResolvedValue(null);

    await expect(automationService.getWebhook(USER_ID, 'bad'))
      .rejects.toThrow('Webhook not found');
  });
});

describe('testWebhook', () => {
  it('should POST to webhook URL and reset failure count', async () => {
    const wh = makeWebhook();
    Webhook.findOne.mockResolvedValue(wh);
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });

    const result = await automationService.testWebhook(USER_ID, 'wh-1');

    expect(axios.post).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({ event: 'test' }),
      expect.any(Object)
    );
    expect(result.success).toBe(true);
    expect(wh.update).toHaveBeenCalledWith(expect.objectContaining({ failure_count: 0 }));
  });

  it('should increment failure count on error', async () => {
    const wh = makeWebhook({ failure_count: 2 });
    Webhook.findOne.mockResolvedValue(wh);
    axios.post.mockRejectedValue({ response: { status: 500 }, message: 'Server Error' });

    await expect(automationService.testWebhook(USER_ID, 'wh-1'))
      .rejects.toThrow('Webhook test failed');

    expect(wh.update).toHaveBeenCalledWith({ failure_count: 3 });
  });
});

// ─── processInboundMessage ────────────────────────────────────────────────────

describe('processInboundMessage', () => {
  const { findMatchingAutomation } = require('../../src/helpers/matcher');
  const { getFlowState } = require('../../src/helpers/flowEngine');

  it('should return null when missing phoneNumberId', async () => {
    const result = await automationService.processInboundMessage({ event: {} }, null);
    expect(result).toBeNull();
  });

  it('should return null when missing event', async () => {
    const result = await automationService.processInboundMessage({ phoneNumberId: 'pn1' }, null);
    expect(result).toBeNull();
  });

  it('should return null when no wa_account found', async () => {
    sequelize.query.mockResolvedValue([]);
    getFlowState.mockResolvedValue(null);

    const result = await automationService.processInboundMessage(
      { phoneNumberId: 'pn1', event: { from: '+91123', type: 'text', text: { body: 'hi' } } },
      null
    );

    expect(result).toBeNull();
  });

  it('should return null when no active automations', async () => {
    sequelize.query.mockResolvedValue([{ id: 'wa-1', user_id: USER_ID, waba_id: 'waba-1' }]);
    getFlowState.mockResolvedValue(null);
    Automation.findAll.mockResolvedValue([]);
    findMatchingAutomation.mockReturnValue(null);

    const result = await automationService.processInboundMessage(
      { phoneNumberId: 'pn1', event: { from: '+91123', type: 'text', text: { body: 'hi' } } },
      null
    );

    expect(result).toBeNull();
  });
});
