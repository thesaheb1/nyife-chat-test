'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const Razorpay = require('razorpay');
const { sequelize, Wallet, Transaction, Invoice } = require('../models');
const { AppError, generateUUID, getPagination, getPaginationMeta, formatCurrency } = require('@nyife/shared-utils');
const config = require('../config');

// Initialize Razorpay instance
let razorpayInstance = null;
const RAZORPAY_RECEIPT_MAX_LENGTH = 40;

async function publishWalletTransactionEvent(kafkaProducer, payload) {
  if (!kafkaProducer) {
    return;
  }

  try {
    const { publishEvent, TOPICS } = require('@nyife/shared-events');
    await publishEvent(kafkaProducer, TOPICS.WALLET_TRANSACTION, payload.userId, payload);
  } catch (err) {
    console.error('[wallet-service] Failed to publish wallet transaction event:', err.message);
  }
}

/**
 * Returns the Razorpay instance, creating it lazily on first use.
 * This avoids errors at startup if keys are not yet configured.
 */
function getRazorpay() {
  if (!razorpayInstance) {
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
      console.error('[wallet-service] Razorpay keys are missing from configuration');
      throw new AppError(
        'Wallet recharge is temporarily unavailable. Please try again later.',
        503,
        [],
        true,
        'WALLET_RECHARGE_UNAVAILABLE'
      );
    }
    razorpayInstance = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayInstance;
}

function buildRechargeReceipt(userId) {
  const normalizedUserId = String(userId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-12);
  const timestamp = Date.now().toString(36);

  return `wallet_${normalizedUserId}_${timestamp}`.slice(0, RAZORPAY_RECEIPT_MAX_LENGTH);
}

/**
 * Finds an existing wallet for the user or creates a new one with zero balance.
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<object>} The wallet record
 */
async function getOrCreateWallet(userId) {
  let wallet = await Wallet.findOne({ where: { user_id: userId } });

  if (!wallet) {
    wallet = await Wallet.create({
      id: generateUUID(),
      user_id: userId,
      balance: 0,
      currency: 'INR',
    });
  }

  return wallet;
}

/**
 * Returns the wallet balance for a given user.
 * Uses Redis cache when available.
 *
 * @param {string} userId - The user's UUID
 * @param {object|null} redis - Redis client instance (optional)
 * @returns {Promise<object>} Wallet data with balance
 */
async function getBalance(userId, redis) {
  const cacheKey = `wallet:balance:${userId}`;

  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('[wallet-service] Redis cache read error:', err.message);
    }
  }

  const wallet = await getOrCreateWallet(userId);

  const result = {
    wallet_id: wallet.id,
    user_id: wallet.user_id,
    balance: wallet.balance,
    balance_formatted: formatCurrency(wallet.balance, wallet.currency),
    currency: wallet.currency,
  };

  // Cache balance for 60 seconds
  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
    } catch (err) {
      console.error('[wallet-service] Redis cache write error:', err.message);
    }
  }

  return result;
}

/**
 * Initiates a wallet recharge by creating a Razorpay order.
 * Calculates tax based on configuration and returns order details for the frontend.
 *
 * @param {string} userId - The user's UUID
 * @param {number} amount - Recharge amount in paise (before tax)
 * @returns {Promise<object>} Razorpay order details and tax breakdown
 */
async function initiateRecharge(userId, amount) {
  if (amount < config.minRechargeAmount) {
    throw AppError.badRequest(`Minimum recharge amount is ${formatCurrency(config.minRechargeAmount)}`);
  }

  const wallet = await getOrCreateWallet(userId);

  // Calculate tax
  const taxRate = config.tax.rate;
  let baseAmount;
  let taxAmount;
  let totalAmount;

  if (config.tax.inclusive) {
    // Amount already includes tax
    totalAmount = amount;
    baseAmount = Math.round(amount / (1 + taxRate / 100));
    taxAmount = totalAmount - baseAmount;
  } else {
    // Tax is added on top
    baseAmount = amount;
    taxAmount = Math.round(amount * taxRate / 100);
    totalAmount = baseAmount + taxAmount;
  }

  // Create Razorpay order
  const razorpay = getRazorpay();
  const receipt = buildRechargeReceipt(userId);
  let order;

  try {
    order = await razorpay.orders.create({
      amount: totalAmount,
      currency: wallet.currency,
      receipt,
      notes: {
        user_id: userId,
        wallet_id: wallet.id,
        type: 'wallet_recharge',
        base_amount: baseAmount,
        tax_amount: taxAmount,
      },
    });
  } catch (error) {
    console.error('[wallet-service] Failed to create Razorpay recharge order:', {
      userId,
      walletId: wallet.id,
      receipt,
      amount: totalAmount,
      message: error?.message,
      statusCode: error?.statusCode,
      code: error?.error?.code,
      description: error?.error?.description,
      reason: error?.error?.reason,
      source: error?.error?.source,
      step: error?.error?.step,
    });

    throw new AppError(
      'Unable to initiate wallet recharge right now. Please try again later.',
      503,
      [],
      true,
      'WALLET_RECHARGE_UNAVAILABLE'
    );
  }

  return {
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    base_amount: baseAmount,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    tax_rate: taxRate,
    tax_type: config.tax.type,
    razorpay_key_id: config.razorpay.keyId,
    wallet_id: wallet.id,
  };
}

/**
 * Verifies the Razorpay payment signature, credits the wallet atomically,
 * creates the transaction record and invoice, and publishes a Kafka event.
 *
 * @param {string} userId - The user's UUID
 * @param {object} paymentData - Contains razorpay_order_id, razorpay_payment_id, razorpay_signature
 * @param {object|null} kafkaProducer - Kafka producer instance (optional)
 * @param {object|null} redis - Redis client instance (optional)
 * @returns {Promise<object>} Credit result with new balance, transaction, and invoice
 */
async function verifyRechargePayment(userId, paymentData, kafkaProducer, redis) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

  // Verify Razorpay signature
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (
    expectedSignature.length !== razorpay_signature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    )
  ) {
    throw AppError.badRequest('Invalid payment signature');
  }

  // Fetch order details from Razorpay to get the amount
  const razorpay = getRazorpay();
  const order = await razorpay.orders.fetch(razorpay_order_id);

  if (!order || order.status !== 'paid') {
    throw AppError.badRequest('Payment order is not in paid status');
  }

  const totalAmount = order.amount;
  const baseAmount = parseInt(order.notes.base_amount || totalAmount, 10);
  const taxAmount = parseInt(order.notes.tax_amount || 0, 10);

  // Atomic wallet credit + transaction + invoice creation
  const result = await sequelize.transaction(async (t) => {
    // Lock the wallet row for update
    const wallet = await Wallet.findOne({
      where: { user_id: userId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!wallet) {
      throw AppError.notFound('Wallet not found');
    }

    // Credit wallet with the base amount (excluding tax)
    const newBalance = wallet.balance + baseAmount;
    await wallet.update({ balance: newBalance }, { transaction: t });

    // Create transaction record
    const transaction = await Transaction.create({
      id: generateUUID(),
      user_id: userId,
      wallet_id: wallet.id,
      type: 'credit',
      amount: baseAmount,
      balance_after: newBalance,
      source: 'recharge',
      reference_type: 'razorpay_order',
      reference_id: razorpay_order_id,
      description: `Wallet recharge of ${formatCurrency(baseAmount)}`,
      payment_id: razorpay_payment_id,
      payment_status: 'completed',
      meta: {
        razorpay_order_id,
        razorpay_payment_id,
        tax_amount: taxAmount,
        total_paid: totalAmount,
      },
    }, { transaction: t });

    // Generate and create invoice
    const invoiceNumber = generateInvoiceNumber();
    const invoice = await Invoice.create({
      id: generateUUID(),
      user_id: userId,
      invoice_number: invoiceNumber,
      type: 'recharge',
      amount: baseAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      tax_details: {
        type: config.tax.type,
        rate: config.tax.rate,
        inclusive: config.tax.inclusive,
      },
      status: 'paid',
      paid_at: new Date(),
      reference_type: 'razorpay_payment',
      reference_id: razorpay_payment_id,
    }, { transaction: t });

    return {
      wallet_id: wallet.id,
      balance: newBalance,
      balance_formatted: formatCurrency(newBalance, wallet.currency),
      transaction_id: transaction.id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
    };
  });

  // Invalidate balance cache
  if (redis) {
    try {
      await redis.del(`wallet:balance:${userId}`);
    } catch (err) {
      console.error('[wallet-service] Redis cache invalidation error:', err.message);
    }
  }

  // Publish Kafka event (best-effort, do not fail the payment flow)
  if (kafkaProducer) {
    try {
      const { publishEvent, TOPICS } = require('@nyife/shared-events');
      await publishWalletTransactionEvent(kafkaProducer, {
        userId,
        amount: baseAmount,
        type: 'credit',
        source: 'recharge',
        balanceAfter: result.balance,
        transactionId: result.transaction_id,
        invoiceId: result.invoice_id,
        paymentId: razorpay_payment_id,
        description: `Wallet recharge of ${formatCurrency(baseAmount)}`,
        referenceType: 'razorpay_order',
        referenceId: razorpay_order_id,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[wallet-service] Failed to publish wallet transaction event:', err.message);
    }
  }

  return result;
}

/**
 * Atomically debits the wallet. Uses SELECT FOR UPDATE to prevent race conditions.
 * Throws if insufficient balance.
 *
 * @param {string} userId - The user's UUID
 * @param {number} amount - Amount to debit in paise
 * @param {string} source - Transaction source enum value
 * @param {string|null} referenceType - Type of reference (e.g., 'campaign', 'message')
 * @param {string|null} referenceId - ID of the reference entity
 * @param {string} description - Human-readable description
 * @param {object|null} redis - Redis client instance (optional)
 * @returns {Promise<object>} Debit result with new balance and transaction ID
 */
function buildIdempotentTransactionResult(transactionRecord) {
  return {
    success: true,
    balance_after: transactionRecord.balance_after,
    balance_formatted: formatCurrency(transactionRecord.balance_after),
    transaction_id: transactionRecord.id,
    idempotency_reused: true,
  };
}

async function findExistingTransactionByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) {
    return null;
  }

  return Transaction.findOne({
    where: { idempotency_key: idempotencyKey },
  });
}

async function debitWallet(
  userId,
  amount,
  source,
  referenceType,
  referenceId,
  description,
  redis,
  kafkaProducer,
  idempotencyKey = null,
  meta = null
) {
  const existingTransaction = await findExistingTransactionByIdempotencyKey(idempotencyKey);
  if (existingTransaction) {
    return buildIdempotentTransactionResult(existingTransaction);
  }

  let result;
  try {
    result = await sequelize.transaction(async (t) => {
    // Lock the wallet row for update
      const wallet = await Wallet.findOne({
        where: { user_id: userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!wallet) {
        throw AppError.notFound('Wallet not found');
      }

      if (wallet.balance < amount) {
        throw AppError.badRequest('Insufficient wallet balance');
      }

      const newBalance = wallet.balance - amount;
      await wallet.update({ balance: newBalance }, { transaction: t });

      const transaction = await Transaction.create({
        id: generateUUID(),
        user_id: userId,
        wallet_id: wallet.id,
        type: 'debit',
        amount,
        balance_after: newBalance,
        source,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        description,
        payment_status: 'completed',
        idempotency_key: idempotencyKey || null,
        meta,
      }, { transaction: t });

      return {
        success: true,
        balance_after: newBalance,
        balance_formatted: formatCurrency(newBalance, wallet.currency),
        transaction_id: transaction.id,
      };
    });
  } catch (err) {
    if (idempotencyKey && err?.name === 'SequelizeUniqueConstraintError') {
      const reusedTransaction = await findExistingTransactionByIdempotencyKey(idempotencyKey);
      if (reusedTransaction) {
        return buildIdempotentTransactionResult(reusedTransaction);
      }
    }
    throw err;
  }

  // Invalidate balance cache
  if (redis) {
    try {
      await redis.del(`wallet:balance:${userId}`);
    } catch (err) {
      console.error('[wallet-service] Redis cache invalidation error:', err.message);
    }
  }

  await publishWalletTransactionEvent(kafkaProducer, {
    userId,
    amount,
    type: 'debit',
    source,
    balanceAfter: result.balance_after,
    transactionId: result.transaction_id,
    description,
    referenceType: referenceType || undefined,
    referenceId: referenceId || undefined,
    meta: meta || undefined,
    timestamp: new Date().toISOString(),
  });

  return result;
}

/**
 * Atomically credits the wallet. Uses SELECT FOR UPDATE to prevent race conditions.
 *
 * @param {string} userId - The user's UUID
 * @param {number} amount - Amount to credit in paise
 * @param {string} source - Transaction source enum value
 * @param {string} description - Human-readable description
 * @param {string|null} referenceType - Type of reference
 * @param {string|null} referenceId - ID of the reference entity
 * @param {string|null} remarks - Additional admin remarks
 * @param {object|null} kafkaProducer - Kafka producer instance (optional)
 * @param {object|null} redis - Redis client instance (optional)
 * @returns {Promise<object>} Credit result with new balance and transaction ID
 */
async function creditWallet(
  userId,
  amount,
  source,
  description,
  referenceType,
  referenceId,
  remarks,
  kafkaProducer,
  redis,
  idempotencyKey = null,
  meta = null
) {
  const existingTransaction = await findExistingTransactionByIdempotencyKey(idempotencyKey);
  if (existingTransaction) {
    return buildIdempotentTransactionResult(existingTransaction);
  }

  let result;
  try {
    result = await sequelize.transaction(async (t) => {
    // Lock the wallet row for update
      const wallet = await Wallet.findOne({
        where: { user_id: userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!wallet) {
        throw AppError.notFound('Wallet not found');
      }

      const newBalance = wallet.balance + amount;
      await wallet.update({ balance: newBalance }, { transaction: t });

      const transaction = await Transaction.create({
        id: generateUUID(),
        user_id: userId,
        wallet_id: wallet.id,
        type: 'credit',
        amount,
        balance_after: newBalance,
        source,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        description,
        remarks: remarks || null,
        payment_status: 'completed',
        idempotency_key: idempotencyKey || null,
        meta,
      }, { transaction: t });

      return {
        success: true,
        balance_after: newBalance,
        balance_formatted: formatCurrency(newBalance, wallet.currency),
        transaction_id: transaction.id,
      };
    });
  } catch (err) {
    if (idempotencyKey && err?.name === 'SequelizeUniqueConstraintError') {
      const reusedTransaction = await findExistingTransactionByIdempotencyKey(idempotencyKey);
      if (reusedTransaction) {
        return buildIdempotentTransactionResult(reusedTransaction);
      }
    }
    throw err;
  }

  // Invalidate balance cache
  if (redis) {
    try {
      await redis.del(`wallet:balance:${userId}`);
    } catch (err) {
      console.error('[wallet-service] Redis cache invalidation error:', err.message);
    }
  }

  // Publish Kafka event (best-effort)
  if (kafkaProducer) {
    try {
      const { publishEvent, TOPICS } = require('@nyife/shared-events');
      await publishWalletTransactionEvent(kafkaProducer, {
        userId,
        amount,
        type: 'credit',
        source,
        balanceAfter: result.balance_after,
        transactionId: result.transaction_id,
        description,
        referenceType: referenceType || undefined,
        referenceId: referenceId || undefined,
        meta: meta || undefined,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[wallet-service] Failed to publish wallet transaction event:', err.message);
    }
  }

  return result;
}

/**
 * Lists transactions for a user with pagination and filtering support.
 *
 * @param {string} userId - The user's UUID
 * @param {object} filters - Filter and pagination options
 * @returns {Promise<object>} Paginated list of transactions with metadata
 */
async function listTransactions(userId, filters) {
  const {
    type,
    source,
    search,
    from_date,
    to_date,
    date_from,
    date_to,
    page,
    limit,
  } = filters;
  const resolvedFromDate = date_from || from_date;
  const resolvedToDate = date_to || to_date;

  const where = { user_id: userId };

  if (type) {
    where.type = type;
  }

  if (source) {
    where.source = source;
  }

  if (search) {
    where[Op.or] = [
      { description: { [Op.like]: `%${search}%` } },
      { remarks: { [Op.like]: `%${search}%` } },
      { reference_type: { [Op.like]: `%${search}%` } },
      { reference_id: { [Op.like]: `%${search}%` } },
    ];
  }

  if (resolvedFromDate || resolvedToDate) {
    where.created_at = {};
    if (resolvedFromDate) {
      where.created_at[Op.gte] = new Date(resolvedFromDate);
    }
    if (resolvedToDate) {
      const endDate = new Date(resolvedToDate);
      endDate.setDate(endDate.getDate() + 1);
      where.created_at[Op.lt] = endDate;
    }
  }

  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const { count, rows } = await Transaction.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return {
    transactions: rows.map((txn) => ({
      id: txn.id,
      type: txn.type,
      amount: txn.amount,
      amount_formatted: formatCurrency(txn.amount),
      balance_after: txn.balance_after,
      balance_after_formatted: formatCurrency(txn.balance_after),
      source: txn.source,
      reference_type: txn.reference_type,
      reference_id: txn.reference_id,
      description: txn.description,
      remarks: txn.remarks,
      payment_id: txn.payment_id,
      payment_status: txn.payment_status,
      created_at: txn.created_at,
    })),
    meta,
  };
}

/**
 * Lists invoices for a user with pagination.
 *
 * @param {string} userId - The user's UUID
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Promise<object>} Paginated list of invoices with metadata
 */
async function listInvoices(userId, filters = {}) {
  const { page = 1, limit = 20, search, status, date_from, date_to } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);
  const where = { user_id: userId };

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [
      { invoice_number: { [Op.like]: `%${search}%` } },
      { type: { [Op.like]: `%${search}%` } },
      { status: { [Op.like]: `%${search}%` } },
    ];
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      const endDate = new Date(date_to);
      endDate.setDate(endDate.getDate() + 1);
      where.created_at[Op.lt] = endDate;
    }
  }

  const { count, rows } = await Invoice.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    offset,
    limit: sanitizedLimit,
  });

  const meta = getPaginationMeta(count, page, limit);

  return {
    invoices: rows.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      type: inv.type,
      amount: inv.amount,
      amount_formatted: formatCurrency(inv.amount),
      tax_amount: inv.tax_amount,
      tax_amount_formatted: formatCurrency(inv.tax_amount),
      total_amount: inv.total_amount,
      total_amount_formatted: formatCurrency(inv.total_amount),
      tax_details: inv.tax_details,
      status: inv.status,
      paid_at: inv.paid_at,
      created_at: inv.created_at,
    })),
    meta,
  };
}

/**
 * Retrieves a single invoice by ID, ensuring it belongs to the requesting user.
 *
 * @param {string} userId - The user's UUID
 * @param {string} invoiceId - The invoice UUID
 * @returns {Promise<object>} Invoice data
 */
async function getInvoice(userId, invoiceId) {
  const invoice = await Invoice.findOne({
    where: { id: invoiceId, user_id: userId },
  });

  if (!invoice) {
    throw AppError.notFound('Invoice not found');
  }

  return {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    type: invoice.type,
    amount: invoice.amount,
    amount_formatted: formatCurrency(invoice.amount),
    tax_amount: invoice.tax_amount,
    tax_amount_formatted: formatCurrency(invoice.tax_amount),
    total_amount: invoice.total_amount,
    total_amount_formatted: formatCurrency(invoice.total_amount),
    tax_details: invoice.tax_details,
    billing_info: invoice.billing_info,
    status: invoice.status,
    paid_at: invoice.paid_at,
    reference_type: invoice.reference_type,
    reference_id: invoice.reference_id,
    created_at: invoice.created_at,
    updated_at: invoice.updated_at,
  };
}

/**
 * Admin operation: Credits a user's wallet with the given amount.
 *
 * @param {string} userId - Target user's UUID
 * @param {number} amount - Amount to credit in paise
 * @param {string} remarks - Admin's reason for the credit
 * @param {object|null} kafkaProducer - Kafka producer instance (optional)
 * @param {object|null} redis - Redis client instance (optional)
 * @returns {Promise<object>} Credit result
 */
async function adminCredit(userId, amount, remarks, kafkaProducer, redis) {
  // Ensure wallet exists before crediting
  await getOrCreateWallet(userId);

  const description = `Admin credit: ${remarks}`;

  return creditWallet(
    userId,
    amount,
    'admin_credit',
    description,
    'admin_action',
    null,
    remarks,
    kafkaProducer,
    redis
  );
}

/**
 * Admin operation: Debits a user's wallet with the given amount.
 * Throws if the wallet has insufficient balance.
 *
 * @param {string} userId - Target user's UUID
 * @param {number} amount - Amount to debit in paise
 * @param {string} remarks - Admin's reason for the debit
 * @param {object|null} redis - Redis client instance (optional)
 * @param {object|null} kafkaProducer - Kafka producer instance (optional)
 * @returns {Promise<object>} Debit result
 */
async function adminDebit(userId, amount, remarks, redis, kafkaProducer) {
  const description = `Admin debit: ${remarks}`;

  return debitWallet(
    userId,
    amount,
    'admin_debit',
    'admin_action',
    null,
    description,
    redis,
    kafkaProducer
  );
}

/**
 * Generates a unique invoice number in the format: NYF-INV-YYYYMMDD-XXXX
 * where XXXX is 4 random hex characters.
 *
 * @returns {string} Invoice number string
 */
function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hex = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `NYF-INV-${year}${month}${day}-${hex}`;
}

module.exports = {
  getOrCreateWallet,
  getBalance,
  initiateRecharge,
  verifyRechargePayment,
  debitWallet,
  creditWallet,
  listTransactions,
  listInvoices,
  getInvoice,
  adminCredit,
  adminDebit,
  buildRechargeReceipt,
  generateInvoiceNumber,
};
