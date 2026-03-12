'use strict';

const {
  buildFullAdminPermissions,
  hasPermission,
} = require('@nyife/shared-utils');
const adminService = require('../services/admin.service');

function buildSuperAdminActor(userId) {
  return {
    id: userId,
    user_id: userId,
    user: {
      id: userId,
      role: 'super_admin',
    },
    actor_type: 'super_admin',
    is_super_admin: true,
    permissions: buildFullAdminPermissions({ includeReserved: true }),
    role: {
      title: 'Super Admin',
      is_system: true,
      permissions: buildFullAdminPermissions({ includeReserved: true }),
    },
    sub_admin: null,
  };
}

const adminRbac = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'];
      const userRole = req.headers['x-user-role'];

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
      }

      if (userRole === 'super_admin') {
        req.adminUser = buildSuperAdminActor(userId);
        return next();
      }

      const actor = await adminService.resolveAdminAuthorization(userId);
      req.adminUser = actor;

      if (!hasPermission(actor.permissions, resource, action)) {
        return res.status(403).json({
          success: false,
          message: `You do not have permission to access ${resource}.`,
          code: 'INSUFFICIENT_PERMISSIONS',
          resource,
          action,
        });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

const superAdminOnly = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  if (userRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED',
    });
  }

  req.adminUser = buildSuperAdminActor(userId);
  return next();
};

module.exports = { adminRbac, superAdminOnly };
