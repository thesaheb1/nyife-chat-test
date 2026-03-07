'use strict';

const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

function getCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function getClearCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token = generateCsrfToken()) {
  res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
  return token;
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE_NAME, getClearCookieOptions());
}

function tokensMatch(cookieToken, headerToken) {
  if (!cookieToken || !headerToken) {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

function csrfProtection(req, res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!tokensMatch(cookieToken, headerToken)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
    });
  }

  return next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  csrfProtection,
};
