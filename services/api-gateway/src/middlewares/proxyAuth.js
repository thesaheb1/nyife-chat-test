'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

const ACCESS_TOKEN_REVOKED_AFTER_KEY_PREFIX = 'auth:access-revoked-after:';

async function resolveApiToken(token) {
  const response = await fetch(
    `${config.services.user}/api/v1/users/internal/api-tokens/resolve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const error = new Error(payload?.message || 'Invalid API token');
    error.statusCode = response.status;
    error.code = payload?.code || 'API_TOKEN_INVALID';
    throw error;
  }

  const payload = await response.json();
  return payload?.data || null;
}

function applyAuthHeaders(req, identity) {
  req.headers['x-user-id'] = identity.userId || identity.id || '';
  req.headers['x-user-role'] = identity.role || '';
  req.headers['x-user-email'] = identity.email || '';
  req.headers['x-user-permissions'] = identity.permissions
    ? JSON.stringify(identity.permissions)
    : '{}';
}

function buildAccessTokenRevokedAfterKey(userId) {
  return `${ACCESS_TOKEN_REVOKED_AFTER_KEY_PREFIX}${userId}`;
}

async function isRevokedAccessToken(req, decoded) {
  const userId = decoded?.id;
  const issuedAt = Number(decoded?.iat || 0);
  const redis = req.app?.locals?.redis;

  if (!userId || !issuedAt || !redis) {
    return false;
  }

  try {
    const rawRevokedAfter = await redis.get(buildAccessTokenRevokedAfterKey(userId));
    if (!rawRevokedAfter) {
      return false;
    }

    const revokedAfter = Number(rawRevokedAfter);
    return Number.isFinite(revokedAfter) && issuedAt <= revokedAfter;
  } catch (error) {
    console.warn('[proxyAuth] Failed to read access-token revocation state:', error.message);
    return false;
  }
}

/**
 * Middleware that verifies a JWT access token from the Authorization header.
 *
 * On success it injects the decoded user payload into request headers so that
 * downstream microservices can trust the identity without re-verifying:
 *   x-user-id          - UUID of the authenticated user
 *   x-user-role        - User role (e.g., 'owner', 'team_member', 'admin')
 *   x-user-email       - User email address
 *   x-user-permissions - JSON-stringified permissions object
 *
 * On failure it returns a 401 JSON error response.
 */
const proxyAuth = (req, res, next) => {
  (async () => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization header provided.',
        code: 'AUTH_REQUIRED',
      });
    }

    // Expect "Bearer <token>" format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid authorization header format. Expected: Bearer <token>',
        code: 'AUTH_INVALID',
      });
    }

    const token = parts[1];

    if (!config.jwt.secret) {
      console.error('[proxyAuth] JWT_SECRET is not configured');
      return res.status(500).json({
        success: false,
        message: 'Internal server error. Authentication is misconfigured.',
        code: 'AUTH_MISCONFIGURED',
      });
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);

      if (await isRevokedAccessToken(req, decoded)) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. This session is no longer valid.',
          code: 'AUTH_TOKEN_REVOKED',
        });
      }

      applyAuthHeaders(req, decoded);
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Access denied. Token has expired.',
          code: 'AUTH_TOKEN_EXPIRED',
        });
      }

      if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
        try {
          const resolved = await resolveApiToken(token);
          if (!resolved?.user) {
            throw new Error('Invalid API token');
          }

          applyAuthHeaders(req, {
            id: resolved.user.id,
            email: resolved.user.email,
            role: resolved.user.role,
            permissions: resolved.user.permissions || {},
          });
          req.headers['x-auth-type'] = 'api_token';
          return next();
        } catch (apiTokenError) {
          return res.status(401).json({
            success: false,
            message: 'Access denied. Invalid token.',
            code: apiTokenError.code || 'API_TOKEN_INVALID',
          });
        }
      }

      console.error('[proxyAuth] Unexpected error during token verification:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication.',
        code: 'AUTH_INTERNAL_ERROR',
      });
    }
  })().catch((err) => {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token has expired.',
        code: 'AUTH_TOKEN_EXPIRED',
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.',
        code: 'AUTH_INVALID',
      });
    }

    if (err.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is not yet active.',
        code: 'AUTH_NOT_ACTIVE',
      });
    }

    console.error('[proxyAuth] Unexpected error during token verification:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      code: 'AUTH_INTERNAL_ERROR',
    });
  });
};

module.exports = proxyAuth;
