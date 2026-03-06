'use strict';

require('../setup');

const walletService = require('../../src/services/wallet.service');
const { Wallet, Transaction, Invoice, sequelize } = require('../../src/models');
const Razorpay = require('razorpay');
const razorpayOrders = new Razorpay().orders;

const USER_ID = 'user-uuid-1';

function makeWallet(overrides = {}) {
  return {
    id: 'wallet-uuid-1',
    user_id: USER_ID,
    balance: 50000,
    currency: 'INR',
    update: jest.fn(),
    ...overrides,
  };
}

function makeTransactionRecord(overrides = {}) {
  return {
    id: 'txn-uuid-1',
    user_id: USER_ID,
    wallet_id: 'wallet-uuid-1',
    type: 'credit',
    amount: 10000,
    balance_after: 60000,
    source: 'recharge',
    reference_type: null,
    reference_id: null,
    description: 'Wallet recharge',
    remarks: null,
    payment_id: null,
    payment_status: 'completed',
    created_at: new Date(),
    ...overrides,
  };
}

function makeInvoiceRecord(overrides = {}) {
  return {
    id: 'inv-uuid-1',
    user_id: USER_ID,
    invoice_number: 'NYF-INV-20260305-AB12',
    type: 'recharge',
    amount: 10000,
    tax_amount: 1800,
    total_amount: 11800,
    tax_details: { type: 'GST', rate: 18, inclusive: false },
    billing_info: null,
    status: 'paid',
    paid_at: new Date(),
    reference_type: 'razorpay_payment',
    reference_id: 'pay_test',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── getOrCreateWallet ────────────────────────────────────────────────────────

describe('getOrCreateWallet', () => {
  it('should return existing wallet when found', async () => {
    const wallet = makeWallet();
    Wallet.findOne.mockResolvedValue(wallet);

    const result = await walletService.getOrCreateWallet(USER_ID);

    expect(Wallet.findOne).toHaveBeenCalledWith({ where: { user_id: USER_ID } });
    expect(result).toBe(wallet);
    expect(Wallet.create).not.toHaveBeenCalled();
  });

  it('should create new wallet when not found', async () => {
    const newWallet = makeWallet({ balance: 0 });
    Wallet.findOne.mockResolvedValue(null);
    Wallet.create.mockResolvedValue(newWallet);

    const result = await walletService.getOrCreateWallet(USER_ID);

    expect(Wallet.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'test-uuid-1234',
      user_id: USER_ID,
      balance: 0,
      currency: 'INR',
    }));
    expect(result).toBe(newWallet);
  });
});

// ─── getBalance ───────────────────────────────────────────────────────────────

describe('getBalance', () => {
  it('should return cached balance from Redis when available', async () => {
    const cached = { wallet_id: 'w1', user_id: USER_ID, balance: 50000, currency: 'INR' };
    const redis = { get: jest.fn().mockResolvedValue(JSON.stringify(cached)), set: jest.fn() };

    const result = await walletService.getBalance(USER_ID, redis);

    expect(redis.get).toHaveBeenCalledWith(`wallet:balance:${USER_ID}`);
    expect(result).toEqual(cached);
    expect(Wallet.findOne).not.toHaveBeenCalled();
  });

  it('should fetch from DB and cache when Redis miss', async () => {
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const wallet = makeWallet();
    Wallet.findOne.mockResolvedValue(wallet);

    const result = await walletService.getBalance(USER_ID, redis);

    expect(result.balance).toBe(50000);
    expect(result.wallet_id).toBe('wallet-uuid-1');
    expect(redis.set).toHaveBeenCalledWith(
      `wallet:balance:${USER_ID}`,
      expect.any(String),
      'EX',
      60
    );
  });

  it('should work without Redis (null redis)', async () => {
    const wallet = makeWallet();
    Wallet.findOne.mockResolvedValue(wallet);

    const result = await walletService.getBalance(USER_ID, null);

    expect(result.balance).toBe(50000);
  });
});

// ─── initiateRecharge ─────────────────────────────────────────────────────────

describe('initiateRecharge', () => {
  it('should throw if amount < minRechargeAmount', async () => {
    await expect(walletService.initiateRecharge(USER_ID, 5000))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('should create Razorpay order with correct amount (tax exclusive)', async () => {
    const wallet = makeWallet();
    Wallet.findOne.mockResolvedValue(wallet);
    razorpayOrders.create.mockResolvedValue({
      id: 'order_test123',
      amount: 11800,
      currency: 'INR',
    });

    const result = await walletService.initiateRecharge(USER_ID, 10000);

    // Tax exclusive: base=10000, tax=1800, total=11800
    expect(razorpayOrders.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 11800,
      currency: 'INR',
    }));
    expect(result.order_id).toBe('order_test123');
    expect(result.base_amount).toBe(10000);
    expect(result.tax_amount).toBe(1800);
    expect(result.total_amount).toBe(11800);
    expect(result.razorpay_key_id).toBe('rzp_test_key');
  });
});

// ─── debitWallet ──────────────────────────────────────────────────────────────

describe('debitWallet', () => {
  it('should successfully debit wallet', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });

    const result = await walletService.debitWallet(
      USER_ID, 10000, 'message_debit', 'campaign', 'camp-1', 'Message charges', null
    );

    expect(wallet.update).toHaveBeenCalledWith({ balance: 40000 }, expect.any(Object));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'debit',
        amount: 10000,
        balance_after: 40000,
        source: 'message_debit',
      }),
      expect.any(Object)
    );
    expect(result.success).toBe(true);
    expect(result.balance_after).toBe(40000);
  });

  it('should throw AppError.notFound if wallet not found', async () => {
    Wallet.findOne.mockResolvedValue(null);

    await expect(walletService.debitWallet(USER_ID, 10000, 'message_debit', null, null, 'desc', null))
      .rejects.toThrow('Wallet not found');
  });

  it('should throw AppError.badRequest if insufficient balance', async () => {
    const wallet = makeWallet({ balance: 5000 });
    Wallet.findOne.mockResolvedValue(wallet);

    await expect(walletService.debitWallet(USER_ID, 10000, 'message_debit', null, null, 'desc', null))
      .rejects.toThrow('Insufficient wallet balance');
  });

  it('should invalidate Redis cache after debit', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });
    const redis = { del: jest.fn().mockResolvedValue(1) };

    await walletService.debitWallet(USER_ID, 10000, 'message_debit', null, null, 'desc', redis);

    expect(redis.del).toHaveBeenCalledWith(`wallet:balance:${USER_ID}`);
  });
});

// ─── creditWallet ─────────────────────────────────────────────────────────────

describe('creditWallet', () => {
  it('should successfully credit wallet', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });

    const result = await walletService.creditWallet(
      USER_ID, 20000, 'admin_credit', 'Admin credit', null, null, 'Bonus', null, null
    );

    expect(wallet.update).toHaveBeenCalledWith({ balance: 70000 }, expect.any(Object));
    expect(result.success).toBe(true);
    expect(result.balance_after).toBe(70000);
  });

  it('should publish Kafka event when producer provided', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });
    const kafkaProducer = {};

    await walletService.creditWallet(
      USER_ID, 20000, 'admin_credit', 'Admin credit', null, null, null, kafkaProducer, null
    );

    const { publishEvent } = require('@nyife/shared-events');
    expect(publishEvent).toHaveBeenCalledWith(
      kafkaProducer,
      'wallet.transaction',
      USER_ID,
      expect.objectContaining({
        user_id: USER_ID,
        type: 'credit',
        source: 'admin_credit',
        amount: 20000,
      })
    );
  });

  it('should invalidate Redis cache', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });
    const redis = { del: jest.fn().mockResolvedValue(1) };

    await walletService.creditWallet(
      USER_ID, 20000, 'admin_credit', 'desc', null, null, null, null, redis
    );

    expect(redis.del).toHaveBeenCalledWith(`wallet:balance:${USER_ID}`);
  });
});

// ─── listTransactions ─────────────────────────────────────────────────────────

describe('listTransactions', () => {
  it('should return paginated transactions', async () => {
    const txns = [makeTransactionRecord(), makeTransactionRecord({ id: 'txn-2' })];
    Transaction.findAndCountAll.mockResolvedValue({ count: 30, rows: txns });

    const result = await walletService.listTransactions(USER_ID, { page: 1, limit: 20 });

    expect(Transaction.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: USER_ID },
      order: [['created_at', 'DESC']],
    }));
    expect(result.transactions).toHaveLength(2);
    expect(result.meta.total).toBe(30);
  });

  it('should apply type and source filters', async () => {
    Transaction.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await walletService.listTransactions(USER_ID, { type: 'credit', source: 'recharge', page: 1, limit: 20 });

    expect(Transaction.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        user_id: USER_ID,
        type: 'credit',
        source: 'recharge',
      }),
    }));
  });
});

// ─── listInvoices ─────────────────────────────────────────────────────────────

describe('listInvoices', () => {
  it('should return paginated invoices', async () => {
    const invoices = [makeInvoiceRecord()];
    Invoice.findAndCountAll.mockResolvedValue({ count: 5, rows: invoices });

    const result = await walletService.listInvoices(USER_ID, 1, 20);

    expect(Invoice.findAndCountAll).toHaveBeenCalled();
    expect(result.invoices).toHaveLength(1);
    expect(result.meta.total).toBe(5);
  });
});

// ─── getInvoice ───────────────────────────────────────────────────────────────

describe('getInvoice', () => {
  it('should return invoice when found', async () => {
    const invoice = makeInvoiceRecord();
    Invoice.findOne.mockResolvedValue(invoice);

    const result = await walletService.getInvoice(USER_ID, 'inv-uuid-1');

    expect(Invoice.findOne).toHaveBeenCalledWith({
      where: { id: 'inv-uuid-1', user_id: USER_ID },
    });
    expect(result.id).toBe('inv-uuid-1');
    expect(result.invoice_number).toBe('NYF-INV-20260305-AB12');
  });

  it('should throw AppError.notFound when not found', async () => {
    Invoice.findOne.mockResolvedValue(null);

    await expect(walletService.getInvoice(USER_ID, 'bad-id'))
      .rejects.toThrow('Invoice not found');
  });
});

// ─── adminCredit / adminDebit ─────────────────────────────────────────────────

describe('adminCredit', () => {
  it('should call creditWallet with correct params', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });

    const result = await walletService.adminCredit(USER_ID, 5000, 'Bonus credit', null, null);

    expect(result.success).toBe(true);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'admin_credit',
        description: 'Admin credit: Bonus credit',
        remarks: 'Bonus credit',
      }),
      expect.any(Object)
    );
  });
});

describe('adminDebit', () => {
  it('should call debitWallet with correct params', async () => {
    const wallet = makeWallet({ balance: 50000 });
    Wallet.findOne.mockResolvedValue(wallet);
    Transaction.create.mockResolvedValue({ id: 'txn-1' });

    const result = await walletService.adminDebit(USER_ID, 5000, 'Penalty', null);

    expect(result.success).toBe(true);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'admin_debit',
        description: 'Admin debit: Penalty',
      }),
      expect.any(Object)
    );
  });
});

// ─── generateInvoiceNumber ────────────────────────────────────────────────────

describe('generateInvoiceNumber', () => {
  it('should return string matching format NYF-INV-YYYYMMDD-XXXX', () => {
    const invoiceNum = walletService.generateInvoiceNumber();

    expect(invoiceNum).toMatch(/^NYF-INV-\d{8}-[A-F0-9]{4}$/);
  });

  it('should include current date', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const invoiceNum = walletService.generateInvoiceNumber();

    expect(invoiceNum).toContain(`NYF-INV-${year}${month}${day}`);
  });
});
