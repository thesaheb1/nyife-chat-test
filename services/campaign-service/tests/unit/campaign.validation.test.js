'use strict';

const {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsSchema,
  campaignIdSchema,
  listCampaignMessagesSchema,
  retryCampaignSchema,
} = require('../../src/validations/campaign.validation');

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('createCampaignSchema', () => {
  const valid = {
    name: 'My Campaign',
    wa_account_id: VALID_UUID,
    template_id: VALID_UUID,
    target_type: 'contacts',
    target_config: { contact_ids: [VALID_UUID] },
  };

  it('should validate with valid data', () => {
    expect(createCampaignSchema.safeParse(valid).success).toBe(true);
  });

  it('should default type to immediate', () => {
    const result = createCampaignSchema.safeParse(valid);
    expect(result.data.type).toBe('immediate');
  });

  it('should reject missing name', () => {
    const { name, ...rest } = valid;
    expect(createCampaignSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject invalid UUID for template_id', () => {
    expect(createCampaignSchema.safeParse({ ...valid, template_id: 'bad' }).success).toBe(false);
  });

  it('should reject invalid target_type', () => {
    expect(createCampaignSchema.safeParse({ ...valid, target_type: 'invalid' }).success).toBe(false);
  });

  it('should accept all valid target types', () => {
    ['group', 'contacts', 'tags', 'all'].forEach(tt => {
      expect(createCampaignSchema.safeParse({ ...valid, target_type: tt }).success).toBe(true);
    });
  });

  it('should accept optional variables_mapping', () => {
    const result = createCampaignSchema.safeParse({ ...valid, variables_mapping: { '1': 'name' } });
    expect(result.success).toBe(true);
  });
});

describe('updateCampaignSchema', () => {
  it('should validate partial update', () => {
    expect(updateCampaignSchema.safeParse({ name: 'New' }).success).toBe(true);
  });

  it('should reject empty object', () => {
    expect(updateCampaignSchema.safeParse({}).success).toBe(false);
  });
});

describe('listCampaignsSchema', () => {
  it('should use defaults', () => {
    const result = listCampaignsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(20);
  });

  it('should accept all filters', () => {
    const result = listCampaignsSchema.safeParse({
      page: 2, limit: 50, status: 'running', search: 'test',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    expect(listCampaignsSchema.safeParse({ status: 'bad' }).success).toBe(false);
  });
});

describe('campaignIdSchema', () => {
  it('should validate valid UUID', () => {
    expect(campaignIdSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(campaignIdSchema.safeParse({ id: 'bad' }).success).toBe(false);
  });
});

describe('listCampaignMessagesSchema', () => {
  it('should use defaults', () => {
    const result = listCampaignMessagesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept status filter', () => {
    expect(listCampaignMessagesSchema.safeParse({ status: 'sent' }).success).toBe(true);
  });
});

describe('retryCampaignSchema', () => {
  it('should validate valid UUID', () => {
    expect(retryCampaignSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });
});
