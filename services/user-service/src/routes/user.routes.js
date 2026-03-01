'use strict';

const { Router } = require('express');
const { authenticate, tenantResolver, asyncHandler } = require('@nyife/shared-middleware');
const userController = require('../controllers/user.controller');

const router = Router();

// ---------------------------------------------------------------------------
// All user routes require authentication and tenant resolution.
// The authenticate middleware verifies the JWT and sets req.user.
// The tenantResolver middleware sets req.tenantId = req.user.id.
// All handlers are wrapped with asyncHandler for automatic error forwarding.
// ---------------------------------------------------------------------------

// Profile routes
router.get(
  '/profile',
  authenticate,
  tenantResolver,
  asyncHandler(userController.getProfile)
);

router.put(
  '/profile',
  authenticate,
  tenantResolver,
  asyncHandler(userController.updateProfile)
);

// Password change route
router.put(
  '/password',
  authenticate,
  tenantResolver,
  asyncHandler(userController.changePassword)
);

// Settings routes
router.get(
  '/settings',
  authenticate,
  tenantResolver,
  asyncHandler(userController.getSettings)
);

router.put(
  '/settings',
  authenticate,
  tenantResolver,
  asyncHandler(userController.updateSettings)
);

// API Token routes
router.post(
  '/api-tokens',
  authenticate,
  tenantResolver,
  asyncHandler(userController.createApiToken)
);

router.get(
  '/api-tokens',
  authenticate,
  tenantResolver,
  asyncHandler(userController.listApiTokens)
);

router.delete(
  '/api-tokens/:id',
  authenticate,
  tenantResolver,
  asyncHandler(userController.revokeApiToken)
);

module.exports = router;
