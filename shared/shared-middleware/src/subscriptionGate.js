'use strict';

const { AppError } = require('@nyife/shared-utils');

function resolveUserId(req) {
  return req.headers['x-user-id'] || req.user?.id || req.user?.userId || null;
}

async function fetchActiveSubscription(userId) {
  const subscriptionServiceUrl = process.env.SUBSCRIPTION_SERVICE_URL || 'http://localhost:3003';
  const response = await fetch(
    `${subscriptionServiceUrl}/api/v1/subscriptions/internal/active/${userId}`,
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
      const userId = resolveUserId(req);
      if (!userId) {
        throw AppError.unauthorized('Authentication is required.', 'AUTH_REQUIRED');
      }

      const subscription = await fetchActiveSubscription(userId);
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
