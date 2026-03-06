'use strict';

const { SubAdmin, AdminRole } = require('../models');

/**
 * Middleware factory that checks if the authenticated user is a super_admin,
 * or a sub-admin with the required permission on the given resource.
 *
 * The API gateway forwards x-user-id and x-user-role headers after JWT verification.
 *
 * @param {string} resource - The resource name (e.g., 'users', 'plans', 'settings')
 * @param {string} action - The action name (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Function} Express middleware
 */
const adminRbac = (resource, action) => {
  return async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Super admin bypasses all permission checks
    if (userRole === 'super_admin') {
      req.adminUser = { id: userId, role: 'super_admin' };
      return next();
    }

    // Check if user is a registered sub-admin with the required permission
    try {
      const subAdmin = await SubAdmin.findOne({
        where: { user_id: userId, status: 'active' },
        include: [{ model: AdminRole, as: 'role' }],
      });

      if (!subAdmin || !subAdmin.role) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const permissions = subAdmin.role.permissions;
      if (
        !permissions ||
        !permissions.resources ||
        !permissions.resources[resource] ||
        !permissions.resources[resource][action]
      ) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions: requires ${resource}.${action}`,
        });
      }

      req.adminUser = {
        id: userId,
        role: 'sub_admin',
        subAdmin,
        permissions: permissions,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Middleware that restricts access to super_admin role only.
 * Used for sensitive operations like managing sub-admins and roles.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const superAdminOnly = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
    });
  }

  req.adminUser = { id: userId, role: 'super_admin' };
  next();
};

module.exports = { adminRbac, superAdminOnly };
