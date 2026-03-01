'use strict';

const walletService = require('../services/wallet.service');
const { successResponse } = require('@nyife/shared-utils');
const { AppError } = require('@nyife/shared-utils');
const {
  rechargeSchema,
  verifyPaymentSchema,
  debitSchema,
  adminCreditDebitSchema,
  transactionFilterSchema,
  invoiceListSchema,
} = require('../validations/wallet.validation');

/**
 * GET /api/v1/wallet
 * Returns the authenticated user's wallet balance.
 */
async function getBalance(req, res) {
  const result = await walletService.getBalance(req.user.id, req.app.locals.redis);
  return successResponse(res, result, 'Wallet balance retrieved');
}

/**
 * POST /api/v1/wallet/recharge
 * Initiates a wallet recharge by creating a Razorpay order.
 * Returns order details for the frontend to complete payment.
 */
async function initiateRecharge(req, res) {
  const data = rechargeSchema.parse(req.body);
  const result = await walletService.initiateRecharge(req.user.id, data.amount);
  return successResponse(res, result, 'Recharge order created', 201);
}

/**
 * POST /api/v1/wallet/recharge/verify
 * Verifies the Razorpay payment signature and credits the wallet.
 */
async function verifyRechargePayment(req, res) {
  const data = verifyPaymentSchema.parse(req.body);
  const result = await walletService.verifyRechargePayment(
    req.user.id,
    data,
    req.app.locals.kafkaProducer,
    req.app.locals.redis
  );
  return successResponse(res, result, 'Payment verified and wallet credited');
}

/**
 * GET /api/v1/wallet/transactions
 * Lists the authenticated user's wallet transactions with filtering and pagination.
 */
async function listTransactions(req, res) {
  const filters = transactionFilterSchema.parse(req.query);
  const result = await walletService.listTransactions(req.user.id, filters);
  return successResponse(res, result.transactions, 'Transactions retrieved', 200, result.meta);
}

/**
 * GET /api/v1/wallet/invoices
 * Lists the authenticated user's invoices with pagination.
 */
async function listInvoices(req, res) {
  const { page, limit } = invoiceListSchema.parse(req.query);
  const result = await walletService.listInvoices(req.user.id, page, limit);
  return successResponse(res, result.invoices, 'Invoices retrieved', 200, result.meta);
}

/**
 * GET /api/v1/wallet/invoices/:id
 * Returns a single invoice belonging to the authenticated user.
 */
async function getInvoice(req, res) {
  const result = await walletService.getInvoice(req.user.id, req.params.id);
  return successResponse(res, result, 'Invoice retrieved');
}

/**
 * POST /api/v1/wallet/debit
 * Internal endpoint for other services to debit a user's wallet.
 * No user authentication required -- expected to be called over internal network only.
 */
async function debit(req, res) {
  const data = debitSchema.parse(req.body);
  const result = await walletService.debitWallet(
    data.user_id,
    data.amount,
    data.source,
    data.reference_type || null,
    data.reference_id || null,
    data.description,
    req.app.locals.redis
  );
  return successResponse(res, result, 'Wallet debited successfully');
}

/**
 * GET /api/v1/wallet/balance/:userId
 * Internal endpoint for other services to check a user's wallet balance.
 * No user authentication required -- expected to be called over internal network only.
 */
async function getBalanceInternal(req, res) {
  const userId = req.params.userId;
  const result = await walletService.getBalance(userId, req.app.locals.redis);
  return successResponse(res, result, 'Wallet balance retrieved');
}

/**
 * POST /api/v1/wallet/admin/credit
 * Admin-only endpoint to credit a user's wallet.
 */
async function adminCredit(req, res) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    throw AppError.forbidden('Admin access required');
  }

  const data = adminCreditDebitSchema.parse(req.body);
  const result = await walletService.adminCredit(
    data.user_id,
    data.amount,
    data.remarks,
    req.app.locals.kafkaProducer,
    req.app.locals.redis
  );
  return successResponse(res, result, 'Wallet credited successfully');
}

/**
 * POST /api/v1/wallet/admin/debit
 * Admin-only endpoint to debit a user's wallet.
 */
async function adminDebit(req, res) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    throw AppError.forbidden('Admin access required');
  }

  const data = adminCreditDebitSchema.parse(req.body);
  const result = await walletService.adminDebit(
    data.user_id,
    data.amount,
    data.remarks,
    req.app.locals.redis
  );
  return successResponse(res, result, 'Wallet debited successfully');
}

module.exports = {
  getBalance,
  initiateRecharge,
  verifyRechargePayment,
  listTransactions,
  listInvoices,
  getInvoice,
  debit,
  getBalanceInternal,
  adminCredit,
  adminDebit,
};
