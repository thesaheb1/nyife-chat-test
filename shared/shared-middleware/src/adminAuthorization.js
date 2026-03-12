'use strict';

const {
  buildFullAdminPermissions,
  hasPermission,
} = require('@nyife/shared-utils');
const { AppError } = require('./errorHandler');

function resolveRequestUserId(req) {
  return req.headers['x-user-id'] || req.user?.id || req.user?.userId || null;
}

function resolveRequestUserRole(req) {
  return req.headers['x-user-role'] || req.user?.role || null;
}

function buildSuperAdminActor(userId) {
  return {
    id: userId,
    user_id: userId,
    actor_type: 'super_admin',
    role: 'super_admin',
    is_super_admin: true,
    permissions: buildFullAdminPermissions({ includeReserved: true }),
  };
}

async function fetchAdminActorContext(userId) {
  const adminServiceUrl = process.env.ADMIN_SERVICE_URL || 'http://localhost:3015';
  const response = await fetch(
    `${adminServiceUrl}/internal/admin/actors/${encodeURIComponent(userId)}/authorization`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || 'Unable to resolve admin authorization right now.';
    const code = payload?.code || null;

    if (response.status === 401) {
      throw AppError.unauthorized(message, code || 'AUTH_REQUIRED');
    }

    if (response.status === 403) {
      throw AppError.forbidden(message, code || 'ADMIN_ACCESS_REQUIRED');
    }

    if (response.status === 404) {
      throw AppError.notFound(message, code || 'ADMIN_ACTOR_NOT_FOUND');
    }

    throw AppError.internal(
      'Unable to resolve admin authorization right now. Please try again shortly.',
      code || 'ADMIN_AUTHORIZATION_FAILED'
    );
  }

  const payload = await response.json().catch(() => null);
  return payload?.data || null;
}

async function resolveAdminActorContext(req) {
  if (req.adminUser) {
    return req.adminUser;
  }

  const userId = resolveRequestUserId(req);
  const userRole = resolveRequestUserRole(req);

  if (!userId) {
    throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
  }

  if (userRole === 'super_admin') {
    req.adminUser = buildSuperAdminActor(userId);
    return req.adminUser;
  }

  const actor = await fetchAdminActorContext(userId);
  req.adminUser = actor;
  return actor;
}

const adminRbac = (resource, action) => {
  return async (req, res, next) => {
    try {
      const actor = await resolveAdminActorContext(req);

      if (actor?.is_super_admin) {
        return next();
      }

      if (!hasPermission(actor?.permissions, resource, action)) {
        return res.status(403).json({
          success: false,
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `You do not have permission to access ${resource}.`,
          resource,
          action,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};

const superAdminOnly = async (req, _res, next) => {
  try {
    const userId = resolveRequestUserId(req);
    const userRole = resolveRequestUserRole(req);

    if (!userId) {
      throw AppError.unauthorized('Authentication required', 'AUTH_REQUIRED');
    }

    if (userRole !== 'super_admin') {
      throw AppError.forbidden('Super admin access required', 'SUPER_ADMIN_REQUIRED');
    }

    req.adminUser = buildSuperAdminActor(userId);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  resolveAdminActorContext,
  adminRbac,
  superAdminOnly,
};
