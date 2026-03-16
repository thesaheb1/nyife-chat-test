'use strict';

const {
  subscribeSchema,
  changePlanSchema,
  verifyPaymentSchema,
  cancelSchema,
  autoRenewSchema,
  validateCouponSchema,
  checkLimitParamsSchema,
  incrementUsageSchema,
  paginationSchema,
} = require('../../src/validations/subscription.validation');

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('subscribeSchema', () => {
  it('should validate with valid plan_id', () => {
    expect(subscribeSchema.safeParse({ plan_id: VALID_UUID }).success).toBe(true);
  });

  it('should accept optional coupon_code', () => {
    const result = subscribeSchema.safeParse({ plan_id: VALID_UUID, coupon_code: 'SAVE20' });
    expect(result.success).toBe(true);
  });

  it('should reject non-uuid plan_id', () => {
    expect(subscribeSchema.safeParse({ plan_id: 'bad' }).success).toBe(false);
  });
});

describe('verifyPaymentSchema', () => {
  const valid = {
    razorpay_order_id: 'order_123',
    razorpay_payment_id: 'pay_456',
    razorpay_signature: 'sig_789',
    subscription_id: VALID_UUID,
  };

  it('should validate with all fields', () => {
    expect(verifyPaymentSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject missing fields', () => {
    const { razorpay_order_id, ...rest } = valid;
    expect(verifyPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject non-uuid subscription_id', () => {
    expect(verifyPaymentSchema.safeParse({ ...valid, subscription_id: 'bad' }).success).toBe(false);
  });
});

describe('changePlanSchema', () => {
  it('should validate with valid plan_id', () => {
    expect(changePlanSchema.safeParse({ plan_id: VALID_UUID }).success).toBe(true);
  });

  it('should accept optional coupon_code', () => {
    expect(changePlanSchema.safeParse({ plan_id: VALID_UUID, coupon_code: 'SAVE20' }).success).toBe(true);
  });
});

describe('cancelSchema', () => {
  it('should validate with/without reason', () => {
    expect(cancelSchema.safeParse({}).success).toBe(true);
    expect(cancelSchema.safeParse({ reason: 'expensive' }).success).toBe(true);
  });

  it('should reject reason > 500 chars', () => {
    expect(cancelSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('autoRenewSchema', () => {
  it('should validate a boolean enabled flag', () => {
    expect(autoRenewSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(autoRenewSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it('should reject missing or invalid enabled values', () => {
    expect(autoRenewSchema.safeParse({}).success).toBe(false);
    expect(autoRenewSchema.safeParse({ enabled: 'yes' }).success).toBe(false);
  });
});

describe('validateCouponSchema', () => {
  it('should validate with valid code and plan_id', () => {
    expect(validateCouponSchema.safeParse({ code: 'SAVE20', plan_id: VALID_UUID }).success).toBe(true);
  });

  it('should reject missing code', () => {
    expect(validateCouponSchema.safeParse({ plan_id: VALID_UUID }).success).toBe(false);
  });

  it('should reject empty code', () => {
    expect(validateCouponSchema.safeParse({ code: '', plan_id: VALID_UUID }).success).toBe(false);
  });
});

describe('checkLimitParamsSchema', () => {
  it('should validate', () => {
    expect(checkLimitParamsSchema.safeParse({ userId: VALID_UUID, resource: 'contacts' }).success).toBe(true);
  });

  it('should reject invalid resource', () => {
    expect(checkLimitParamsSchema.safeParse({ userId: VALID_UUID, resource: 'bad' }).success).toBe(false);
  });

  it('should accept all valid resources', () => {
    ['contacts', 'templates', 'campaigns', 'messages', 'team_members', 'organizations', 'whatsapp_numbers']
      .forEach(r => expect(checkLimitParamsSchema.safeParse({ userId: VALID_UUID, resource: r }).success).toBe(true));
  });
});

describe('incrementUsageSchema', () => {
  it('should validate with defaults', () => {
    const result = incrementUsageSchema.safeParse({ resource: 'contacts' });
    expect(result.success).toBe(true);
    expect(result.data.count).toBe(1);
  });

  it('should reject non-positive count', () => {
    expect(incrementUsageSchema.safeParse({ resource: 'contacts', count: 0 }).success).toBe(false);
    expect(incrementUsageSchema.safeParse({ resource: 'contacts', count: -1 }).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('should use defaults', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 1, limit: 20 });
  });

  it('should coerce strings', () => {
    const result = paginationSchema.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ page: 2, limit: 50 });
  });

  it('should reject out-of-range values', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
