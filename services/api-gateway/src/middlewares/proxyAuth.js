'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

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
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authorization header provided.',
      });
    }

    // Expect "Bearer <token>" format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid authorization header format. Expected: Bearer <token>',
      });
    }

    const token = parts[1];

    if (!config.jwt.secret) {
      console.error('[proxyAuth] JWT_SECRET is not configured');
      return res.status(500).json({
        success: false,
        message: 'Internal server error. Authentication is misconfigured.',
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    // Inject user identity headers for downstream services.
    // These headers are trusted because downstream services sit behind
    // the gateway on an internal network.
    req.headers['x-user-id'] = decoded.userId || decoded.id || '';
    req.headers['x-user-role'] = decoded.role || '';
    req.headers['x-user-email'] = decoded.email || '';
    req.headers['x-user-permissions'] = decoded.permissions
      ? JSON.stringify(decoded.permissions)
      : '{}';

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token has expired.',
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.',
      });
    }

    if (err.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is not yet active.',
      });
    }

    console.error('[proxyAuth] Unexpected error during token verification:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
    });
  }
};

module.exports = proxyAuth;
