'use strict';

const {
  createAutomationSchema,
  updateAutomationSchema,
  updateAutomationStatusSchema,
  listAutomationsSchema,
  automationIdSchema,
  listLogsSchema,
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdSchema,
} = require('../../src/validations/automation.validation');

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('createAutomationSchema', () => {
  const valid = {
    name: 'My Auto',
    wa_account_id: VALID_UUID,
    type: 'basic_reply',
    trigger_config: { trigger_type: 'exact', trigger_value: 'hello' },
    action_config: { content: 'Hi!' },
  };

  it('should validate with valid data', () => {
    expect(createAutomationSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing name', () => {
    const { name, ...rest } = valid;
    expect(createAutomationSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject invalid type', () => {
    expect(createAutomationSchema.safeParse({ ...valid, type: 'bad' }).success).toBe(false);
  });

  it('should accept all valid types', () => {
    ['basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger'].forEach(t => {
      expect(createAutomationSchema.safeParse({ ...valid, type: t }).success).toBe(true);
    });
  });

  it('should allow passthrough on trigger_config', () => {
    const result = createAutomationSchema.safeParse({
      ...valid,
      trigger_config: { trigger_type: 'exact', trigger_value: 'hi', custom_field: true },
    });
    expect(result.success).toBe(true);
  });

  it('should default priority to 0', () => {
    const result = createAutomationSchema.safeParse(valid);
    expect(result.data.priority).toBe(0);
  });
});

describe('updateAutomationSchema', () => {
  it('should validate partial update', () => {
    expect(updateAutomationSchema.safeParse({ name: 'New' }).success).toBe(true);
  });

  it('should reject empty object', () => {
    expect(updateAutomationSchema.safeParse({}).success).toBe(false);
  });
});

describe('updateAutomationStatusSchema', () => {
  it('should accept valid statuses', () => {
    ['active', 'inactive', 'draft'].forEach(s => {
      expect(updateAutomationStatusSchema.safeParse({ status: s }).success).toBe(true);
    });
  });

  it('should reject invalid status', () => {
    expect(updateAutomationStatusSchema.safeParse({ status: 'bad' }).success).toBe(false);
  });
});

describe('listAutomationsSchema', () => {
  it('should use defaults', () => {
    const result = listAutomationsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
  });

  it('should accept all filters', () => {
    const result = listAutomationsSchema.safeParse({
      status: 'active', type: 'basic_reply', search: 'test', wa_account_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });
});

describe('automationIdSchema', () => {
  it('should validate UUID', () => {
    expect(automationIdSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it('should reject non-UUID', () => {
    expect(automationIdSchema.safeParse({ id: 'bad' }).success).toBe(false);
  });
});

describe('listLogsSchema', () => {
  it('should use defaults', () => {
    const result = listLogsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(20);
  });
});

describe('createWebhookSchema', () => {
  const valid = {
    name: 'My Webhook',
    url: 'https://example.com/hook',
    events: ['message.received'],
  };

  it('should validate', () => {
    expect(createWebhookSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject invalid url', () => {
    expect(createWebhookSchema.safeParse({ ...valid, url: 'not-a-url' }).success).toBe(false);
  });

  it('should reject empty events', () => {
    expect(createWebhookSchema.safeParse({ ...valid, events: [] }).success).toBe(false);
  });

  it('should accept optional secret and headers', () => {
    const result = createWebhookSchema.safeParse({
      ...valid, secret: 'mysecret', headers: { 'x-api-key': 'abc' },
    });
    expect(result.success).toBe(true);
  });
});

describe('updateWebhookSchema', () => {
  it('should validate partial', () => {
    expect(updateWebhookSchema.safeParse({ name: 'New' }).success).toBe(true);
  });

  it('should reject empty object', () => {
    expect(updateWebhookSchema.safeParse({}).success).toBe(false);
  });
});

describe('webhookIdSchema', () => {
  it('should validate UUID', () => {
    expect(webhookIdSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it('should reject non-UUID', () => {
    expect(webhookIdSchema.safeParse({ id: 'bad' }).success).toBe(false);
  });
});
