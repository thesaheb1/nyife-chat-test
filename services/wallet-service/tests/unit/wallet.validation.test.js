'use strict';

const {
  rechargeSchema,
  verifyPaymentSchema,
  debitSchema,
  adminCreditDebitSchema,
  transactionFilterSchema,
  invoiceListSchema,
} = require('../../src/validations/wallet.validation');

describe('rechargeSchema', () => {
  it('should validate with amount >= 10000', () => {
    const result = rechargeSchema.safeParse({ amount: 10000 });
    expect(result.success).toBe(true);
    expect(result.data.amount).toBe(10000);
  });

  it('should reject amount < 10000', () => {
    const result = rechargeSchema.safeParse({ amount: 9999 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer amount', () => {
    const result = rechargeSchema.safeParse({ amount: 100.5 });
    expect(result.success).toBe(false);
  });

  it('should reject missing amount', () => {
    const result = rechargeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('verifyPaymentSchema', () => {
  const valid = {
    razorpay_order_id: 'order_123',
    razorpay_payment_id: 'pay_456',
    razorpay_signature: 'sig_789',
  };

  it('should validate with all fields', () => {
    const result = verifyPaymentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject missing razorpay_order_id', () => {
    const { razorpay_order_id, ...rest } = valid;
    expect(verifyPaymentSchema.safeParse(rest).success).toBe(false);
  });

  it('should reject empty razorpay_payment_id', () => {
    expect(verifyPaymentSchema.safeParse({ ...valid, razorpay_payment_id: '' }).success).toBe(false);
  });

  it('should reject empty razorpay_signature', () => {
    expect(verifyPaymentSchema.safeParse({ ...valid, razorpay_signature: '' }).success).toBe(false);
  });
});

describe('debitSchema', () => {
  const valid = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    amount: 5000,
    source: 'message_debit',
    description: 'Message charges',
  };

  it('should validate with valid data', () => {
    const result = debitSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID', () => {
    expect(debitSchema.safeParse({ ...valid, user_id: 'bad' }).success).toBe(false);
  });

  it('should reject negative amount', () => {
    expect(debitSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false);
  });

  it('should reject invalid source enum', () => {
    expect(debitSchema.safeParse({ ...valid, source: 'invalid' }).success).toBe(false);
  });

  it('should accept all valid sources', () => {
    const sources = ['recharge', 'message_debit', 'admin_credit', 'admin_debit', 'refund', 'subscription_payment'];
    for (const source of sources) {
      expect(debitSchema.safeParse({ ...valid, source }).success).toBe(true);
    }
  });
});

describe('adminCreditDebitSchema', () => {
  it('should validate with valid data', () => {
    const result = adminCreditDebitSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 5000,
      remarks: 'Bonus credit',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing remarks', () => {
    const result = adminCreditDebitSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 5000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty remarks', () => {
    const result = adminCreditDebitSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      amount: 5000,
      remarks: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('transactionFilterSchema', () => {
  it('should use defaults when no values provided', () => {
    const result = transactionFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(20);
  });

  it('should validate with all filters', () => {
    const result = transactionFilterSchema.safeParse({
      type: 'credit',
      source: 'recharge',
      from_date: '2026-01-01',
      to_date: '2026-03-01',
      page: 2,
      limit: 50,
    });
    expect(result.success).toBe(true);
    expect(result.data.type).toBe('credit');
    expect(result.data.source).toBe('recharge');
  });

  it('should coerce string numbers', () => {
    const result = transactionFilterSchema.safeParse({ page: '3', limit: '10' });
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(3);
    expect(result.data.limit).toBe(10);
  });
});

describe('invoiceListSchema', () => {
  it('should use defaults', () => {
    const result = invoiceListSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(20);
  });

  it('should accept custom values', () => {
    const result = invoiceListSchema.safeParse({ page: 5, limit: 50 });
    expect(result.success).toBe(true);
    expect(result.data.page).toBe(5);
    expect(result.data.limit).toBe(50);
  });
});
