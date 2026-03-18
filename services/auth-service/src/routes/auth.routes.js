'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('@nyife/shared-middleware');
const { asyncHandler } = require('@nyife/shared-middleware');
const { csrfProtection } = require('../middlewares/csrf.middleware');

// Public routes (no auth required)
router.get('/csrf-token', asyncHandler(authController.getCsrfToken));
router.post('/register', csrfProtection, asyncHandler(authController.register));
router.post('/verify-email', csrfProtection, asyncHandler(authController.verifyEmail));
router.post('/resend-verification', csrfProtection, asyncHandler(authController.resendVerificationEmail));
router.post('/login', csrfProtection, asyncHandler(authController.login));
router.post('/refresh', csrfProtection, asyncHandler(authController.refresh));
router.post('/forgot-password', csrfProtection, asyncHandler(authController.forgotPassword));
router.post('/reset-password', csrfProtection, asyncHandler(authController.resetPassword));

// OAuth routes (public)
router.post('/google', csrfProtection, asyncHandler(authController.googleAuth));
router.post('/facebook', csrfProtection, asyncHandler(authController.facebookAuth));

// Protected routes (require auth)
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.post('/logout', authenticate, csrfProtection, asyncHandler(authController.logout));

module.exports = router;
