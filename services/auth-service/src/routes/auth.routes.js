'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('@nyife/shared-middleware');
const { asyncHandler } = require('@nyife/shared-middleware');

// Public routes (no auth required)
router.post('/register', asyncHandler(authController.register));
router.post('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/login', asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/reset-password', asyncHandler(authController.resetPassword));

// OAuth routes (public)
router.post('/google', asyncHandler(authController.googleAuth));
router.post('/facebook', asyncHandler(authController.facebookAuth));

// Protected routes (require auth)
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.post('/logout', authenticate, asyncHandler(authController.logout));

module.exports = router;
