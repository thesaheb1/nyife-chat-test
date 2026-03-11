'use strict';

const { AppError } = require('@nyife/shared-utils');
const { resolveUserId } = require('./tenantMiddleware');

function resolveSubscriptionScopeId(req) {
  return req.organizationId || req.headers['x-organization-id'] || resolveUserId(req);
}

async function fetchActiveSubscription(scopeId) {
  const subscriptionServiceUrl = process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003';
  const response = await fetch(
    `${subscriptionServiceUrl}/api/v1/subscriptions/internal/active/${scopeId}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    }
  );



  if (!response.ok) {
    throw AppError.internal(
      'Unable to verify your subscription right now. Please try again in a moment.',
      'SUBSCRIPTION_CHECK_FAILED'
    );
  }

  const payload = await response.json();
  return payload?.data?.subscription || null;
}

function requireActiveSubscription(action = 'continue') {
  return async (req, _res, next) => {
    try {
      const scopeId = resolveSubscriptionScopeId(req);
      if (!scopeId) {
        throw AppError.unauthorized('Authentication is required.', 'AUTH_REQUIRED');
      }

      const subscription = await fetchActiveSubscription(scopeId);
      if (!subscription?.plan || subscription.status !== 'active') {
        throw AppError.forbidden(
          `An active subscription is required to ${action}.`,
          'SUBSCRIPTION_REQUIRED'
        );
      }

      req.activeSubscription = subscription;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  requireActiveSubscription,
};
