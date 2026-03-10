'use strict';

const { z } = require('zod');

const TRANSACTION_SOURCES = [
  'recharge',
  'message_debit',
  'message_refund',
  'message_adjustment',
  'admin_credit',
  'admin_debit',
  'refund',
  'subscription_payment',
];

/**
 * Schema for initiating a wallet recharge.
 * Amount is in paise (minimum 10000 = 100 INR).
 */
const rechargeSchema = z.object({
  amount: z.number().int('Amount must be a whole number').min(10000, 'Minimum recharge is \u20B9100'),
});

/**
 * Schema for verifying a Razorpay payment after frontend payment completion.
 */
const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Razorpay order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Razorpay payment ID is required'),
  razorpay_signature: z.string().min(1, 'Razorpay signature is required'),
});

/**
 * Schema for internal wallet debit (called by other services).
 */
const debitSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  amount: z.number().int('Amount must be a whole number').positive('Amount must be positive'),
  source: z.enum(TRANSACTION_SOURCES, {
    errorMap: () => ({ message: `Source must be one of: ${TRANSACTION_SOURCES.join(', ')}` }),
  }),
  reference_type: z.string().max(50).optional(),
  reference_id: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required'),
  meta: z.record(z.any()).optional(),
});

const creditSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  amount: z.number().int('Amount must be a whole number').positive('Amount must be positive'),
  source: z.enum(TRANSACTION_SOURCES, {
    errorMap: () => ({ message: `Source must be one of: ${TRANSACTION_SOURCES.join(', ')}` }),
  }),
  description: z.string().min(1, 'Description is required'),
  reference_type: z.string().max(50).optional(),
  reference_id: z.string().max(100).optional(),
  remarks: z.string().max(1000).optional(),
  meta: z.record(z.any()).optional(),
});

/**
 * Schema for admin credit/debit operations.
 */
const adminCreditDebitSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  amount: z.number().int('Amount must be a whole number').positive('Amount must be positive'),
  remarks: z.string().min(1, 'Remarks are required'),
});

/**
 * Schema for filtering transactions list.
 */
const transactionFilterSchema = z.object({
  type: z.enum(['credit', 'debit']).optional(),
  source: z.enum(TRANSACTION_SOURCES).optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Schema for paginated invoice listing.
 */
const invoiceListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  rechargeSchema,
  verifyPaymentSchema,
  debitSchema,
  creditSchema,
  adminCreditDebitSchema,
  transactionFilterSchema,
  invoiceListSchema,
};
