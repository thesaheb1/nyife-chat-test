'use strict';

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authenticate, organizationResolver, asyncHandler, rbac } = require('@nyife/shared-middleware');

// ─── Authenticated user routes ──────────────────────────────────────────────

// Get wallet balance
router.get('/', authenticate, organizationResolver, rbac('wallet', 'read'), asyncHandler(walletController.getBalance));

// Initiate a wallet recharge (creates Razorpay order)
router.post('/recharge', authenticate, organizationResolver, rbac('wallet', 'create'), asyncHandler(walletController.initiateRecharge));

// Verify Razorpay payment and credit wallet
router.post('/recharge/verify', authenticate, organizationResolver, rbac('wallet', 'create'), asyncHandler(walletController.verifyRechargePayment));

// List transactions with filtering and pagination
router.get('/transactions', authenticate, organizationResolver, rbac('wallet', 'read'), asyncHandler(walletController.listTransactions));

// List invoices with pagination
router.get('/invoices', authenticate, organizationResolver, rbac('billing', 'read'), asyncHandler(walletController.listInvoices));

// Get a single invoice by ID
router.get('/invoices/:id', authenticate, organizationResolver, rbac('billing', 'read'), asyncHandler(walletController.getInvoice));

// ─── Internal routes (called by other services, no auth) ────────────────────

// Debit a user's wallet (internal service-to-service)
router.post('/debit', asyncHandler(walletController.debit));

// Credit/refund a user's wallet (internal service-to-service)
router.post('/credit', asyncHandler(walletController.credit));

// Get a user's balance by userId (internal service-to-service)
router.get('/balance/:userId', asyncHandler(walletController.getBalanceInternal));

// ─── Admin routes ───────────────────────────────────────────────────────────

// Admin: Credit a user's wallet
router.post('/admin/credit', authenticate, asyncHandler(walletController.adminCredit));

// Admin: Debit a user's wallet
router.post('/admin/debit', authenticate, asyncHandler(walletController.adminDebit));

module.exports = router;
