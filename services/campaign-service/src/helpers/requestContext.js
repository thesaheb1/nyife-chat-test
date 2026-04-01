'use strict';

const { AppError } = require('@nyife/shared-utils');

function readHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveCampaignRequestContext(req) {
  const actorUserId = readHeaderValue(req.headers['x-user-id']) || req.user?.id || req.user?.userId || null;
  const organizationId =
    req.organizationId
    || readHeaderValue(req.headers['x-organization-id'])
    || req.organization?.id
    || null;
  const scopeId = organizationId || actorUserId;

  if (!scopeId) {
    throw AppError.unauthorized('Authentication and organization context are required.');
  }

 
  return {
    actorUserId,
    organizationId,
    scopeId,
  };
}

function resolveScopeId(requestContext) {
  if (typeof requestContext === 'string') {
    return requestContext;
  }

  return requestContext?.scopeId || requestContext?.organizationId || requestContext?.actorUserId || null;
}

function buildInternalOrganizationHeaders(requestContext) {
  const headers = {};
  const scopeId = resolveScopeId(requestContext);

  if (requestContext?.actorUserId) {
    headers['x-user-id'] = requestContext.actorUserId;
  } else if (scopeId) {
    headers['x-user-id'] = scopeId;
  }

  if (requestContext?.organizationId) {
    headers['x-organization-id'] = requestContext.organizationId;
  }

  return headers;
}

module.exports = {
  buildInternalOrganizationHeaders,
  resolveCampaignRequestContext,
  resolveScopeId,
};
