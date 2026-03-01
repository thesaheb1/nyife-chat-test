'use strict';

/**
 * Express middleware that resolves the tenant context from the authenticated user.
 *
 * In Nyife's SaaS model, the authenticated user IS the tenant (account owner).
 * This middleware sets req.tenantId to the user's ID so that all downstream
 * database queries can scope data to the correct tenant.
 *
 * Requires authenticate middleware to have run first (req.user must be set).
 */
const tenantResolver = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication required for tenant resolution.',
    });
  }

  req.tenantId = req.user.id;

  next();
};

module.exports = {
  tenantResolver,
};
