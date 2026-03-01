'use strict';

const jwt = require('jsonwebtoken');

/**
 * Express middleware that authenticates requests via Bearer token.
 * Extracts the JWT from the Authorization header, verifies it,
 * and sets req.user with the decoded payload (id, email, role, permissions).
 *
 * Returns 401 if no token is provided, the token is expired, or the token is invalid.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment variables');
    }

    const decoded = jwt.verify(token, secret);

    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
      });
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Unexpected errors (e.g., missing JWT_SECRET)
    next(error);
  }
};

/**
 * Express middleware that optionally authenticates requests via Bearer token.
 * If a valid token is present, sets req.user with the decoded payload.
 * If no token is present or the token is invalid, sets req.user = null and continues.
 * This middleware never rejects a request.
 */
const authenticateOptional = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, secret);

    req.user = decoded;

    next();
  } catch (error) {
    // For optional auth, any token error just means no authenticated user
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  authenticateOptional,
};
