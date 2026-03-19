'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-gateway-secret';

const assert = require('node:assert/strict');
const { afterEach, describe, it, mock } = require('node:test');
const jwt = require('jsonwebtoken');

const proxyAuth = require('../src/middlewares/proxyAuth');

afterEach(() => {
  mock.restoreAll();
});

function runProxyAuth(req) {
  return new Promise((resolve) => {
    const result = {
      statusCode: null,
      body: null,
      nextCalled: false,
    };

    const res = {
      status(code) {
        result.statusCode = code;
        return {
          json(payload) {
            result.body = payload;
            resolve(result);
          },
        };
      },
    };

    proxyAuth(req, res, () => {
      result.nextCalled = true;
      resolve(result);
    });
  });
}

describe('proxyAuth', () => {
  it('rejects revoked access tokens', async () => {
    const token = jwt.sign(
      { id: 'user-1', email: 'user@example.com', role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const redis = {
      async get(key) {
        assert.equal(key, 'auth:access-revoked-after:user-1');
        return String(decoded.iat);
      },
    };

    const result = await runProxyAuth({
      headers: { authorization: `Bearer ${token}` },
      app: { locals: { redis } },
    });

    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 401);
    assert.equal(result.body?.code, 'AUTH_TOKEN_REVOKED');
  });

  it('passes valid non-revoked access tokens through and injects headers', async () => {
    const token = jwt.sign(
      { id: 'user-2', email: 'ok@example.com', role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const req = {
      headers: { authorization: `Bearer ${token}` },
      app: {
        locals: {
          redis: {
            async get() {
              return null;
            },
          },
        },
      },
    };

    const result = await runProxyAuth(req);

    assert.equal(result.nextCalled, true);
    assert.equal(req.headers['x-user-id'], 'user-2');
    assert.equal(req.headers['x-user-email'], 'ok@example.com');
    assert.equal(req.headers['x-user-role'], 'user');
  });
});
