'use strict';

const { AppError } = require('@nyife/shared-utils');

/**
 * Express middleware that resolves the tenant context from the authenticated user.
 *
 * Legacy user-scoped tenant resolver used by auth/user-service routes that
 * still operate on the authenticated user profile rather than an organization.
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

function resolveUserId(req) {
  return req.headers['x-user-id'] || req.user?.id || req.user?.userId || null;
}

async function fetchOrganizationContext(userId, organizationId) {
  const organizationServiceUrl = process.env.ORGANIZATION_SERVICE_URL || 'http://localhost:3011';
  const response = await fetch(
    `${organizationServiceUrl}/api/v1/organizations/internal/context/resolve`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        organization_id: organizationId || null,
      }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.message || 'Unable to resolve your organization context right now.';

    if (response.status === 401) {
      throw AppError.unauthorized(message, 'ORG_CONTEXT_UNAUTHORIZED');
    }
    if (response.status === 403) {
      throw AppError.forbidden(message, 'ORG_CONTEXT_FORBIDDEN');
    }
    if (response.status === 404) {
      throw AppError.notFound(message, 'ORG_NOT_FOUND');
    }

    throw AppError.internal(
      'Unable to resolve your organization right now. Please try again in a moment.',
      'ORG_CONTEXT_FAILED'
    );
  }

  const payload = await response.json();
  return payload?.data || null;
}

function applyOrganizationContext(req, context) {
  req.organization = context.organization;
  req.organizationId = context.organization.id;
  req.organizationMembership = context.membership || null;
  req.tenantId = context.organization.id;

  req.user = {
    ...(req.user || {}),
    organizationRole: context.role || (req.user?.role === 'super_admin' ? 'owner' : 'team'),
    permissions: context.permissions || req.user?.permissions || {},
  };
}

/**
 * Organization-first context resolver.
 *
 * - Reads the requested organization from X-Organization-Id when present
 * - Falls back to the user's default/first accessible organization
 * - Validates access via organization-service
 * - Sets req.organizationId and req.tenantId for downstream compatibility
 */
async function organizationResolver(req, _res, next) {
  try {
    const userId = resolveUserId(req);

    if (!userId) {
      throw AppError.unauthorized('Authentication is required.', 'AUTH_REQUIRED');
    }

    const requestedOrganizationId = req.headers['x-organization-id'] || null;
    const context = await fetchOrganizationContext(userId, requestedOrganizationId);

    if (!context?.organization?.id) {
      throw AppError.forbidden(
        'No accessible organization was found for this account.',
        'ORG_CONTEXT_MISSING'
      );
    }

    applyOrganizationContext(req, context);

    next();
  } catch (error) {
    next(error);
  }
}

function organizationParamResolver(paramName = 'id') {
  return async (req, _res, next) => {
    try {
      const userId = resolveUserId(req);

      if (!userId) {
        throw AppError.unauthorized('Authentication is required.', 'AUTH_REQUIRED');
      }

      const requestedOrganizationId = req.params?.[paramName];

      if (!requestedOrganizationId) {
        throw AppError.badRequest('Organization ID is required.', [], 'ORG_ID_REQUIRED');
      }

      const context = await fetchOrganizationContext(userId, requestedOrganizationId);

      if (!context?.organization?.id) {
        throw AppError.forbidden(
          'No accessible organization was found for this account.',
          'ORG_CONTEXT_MISSING'
        );
      }

      applyOrganizationContext(req, context);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  tenantResolver,
  organizationResolver,
  organizationParamResolver,
  resolveUserId,
};
