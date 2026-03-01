'use strict';

/**
 * Factory function that creates RBAC (Role-Based Access Control) middleware.
 *
 * @param {string} resource - The resource name to check permissions for (e.g., 'contacts', 'chat', 'finance')
 * @param {string} permission - The permission type to check (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Function} Express middleware that enforces the permission check
 *
 * Authorization logic:
 * - 'owner' and 'super_admin' roles bypass all permission checks
 * - All other roles must have explicit permission granted in req.user.permissions.resources[resource][permission]
 */
const rbac = (resource, permission) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const { role, permissions } = req.user;

    // Owner and super_admin bypass all permission checks
    if (role === 'owner' || role === 'super_admin') {
      return next();
    }

    // Verify permission structure exists
    if (
      !permissions ||
      !permissions.resources ||
      !permissions.resources[resource]
    ) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    // Check specific permission flag
    if (permissions.resources[resource][permission] !== true) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

module.exports = {
  rbac,
};
