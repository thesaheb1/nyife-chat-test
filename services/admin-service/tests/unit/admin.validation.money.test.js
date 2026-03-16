'use strict';

const {
  createPlanSchema,
  createCouponSchema,
  updateCouponSchema,
  walletActionSchema,
} = require('../../src/validations/admin.validation');

describe('admin money validations', () => {
  it('accepts rupee amounts for plan pricing fields', () => {
    const result = createPlanSchema.safeParse({
      name: 'Pro',
      slug: 'pro',
      type: 'monthly',
      price: 999.5,
      currency: 'INR',
      max_contacts: 100,
      max_templates: 10,
      max_campaigns_per_month: 5,
      max_messages_per_month: 1000,
      max_team_members: 2,
      max_organizations: 1,
      max_whatsapp_numbers: 1,
      marketing_message_price: 0.8,
      utility_message_price: 0.5,
      auth_message_price: 0.25,
      sort_order: 0,
      is_active: true,
      has_priority_support: false,
    });

    expect(result.success).toBe(true);
  });

  it('accepts wallet action amounts in rupees with two decimals', () => {
    const result = walletActionSchema.safeParse({
      amount: 150.75,
      remarks: 'Manual credit',
    });

    expect(result.success).toBe(true);
  });

  it('rejects wallet action amounts with more than two decimals', () => {
    const result = walletActionSchema.safeParse({
      amount: 150.755,
      remarks: 'Manual credit',
    });

    expect(result.success).toBe(false);
  });

  it('accepts fixed coupon amounts in rupees', () => {
    const result = createCouponSchema.safeParse({
      code: 'SAVE99',
      discount_type: 'fixed',
      discount_value: 99.5,
      min_plan_price: 499.99,
      valid_from: '2026-03-16',
      is_active: true,
    });

    expect(result.success).toBe(true);
  });

  it('rejects fixed coupon amounts with more than two decimals', () => {
    const result = createCouponSchema.safeParse({
      code: 'SAVE99',
      discount_type: 'fixed',
      discount_value: 12.345,
      valid_from: '2026-03-16',
      is_active: true,
    });

    expect(result.success).toBe(false);
  });

  it('accepts percentage coupon discounts as whole numbers only', () => {
    expect(
      createCouponSchema.safeParse({
        code: 'SAVE20',
        discount_type: 'percentage',
        discount_value: 20,
        valid_from: '2026-03-16',
        is_active: true,
      }).success
    ).toBe(true);

    expect(
      createCouponSchema.safeParse({
        code: 'SAVE20',
        discount_type: 'percentage',
        discount_value: 20.5,
        valid_from: '2026-03-16',
        is_active: true,
      }).success
    ).toBe(false);
  });

  it('requires discount_type when updating only the discount value', () => {
    const result = updateCouponSchema.safeParse({
      discount_value: 99.5,
    });

    expect(result.success).toBe(false);
  });
});
