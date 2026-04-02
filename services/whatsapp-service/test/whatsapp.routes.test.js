'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/whatsapp.routes');

test('internal campaign media resolve route is registered before authenticate middleware', () => {
  const internalRouteIndex = router.stack.findIndex(
    (layer) => layer.route?.path === '/internal/campaign-media/resolve'
  );
  const authenticateIndex = router.stack.findIndex(
    (layer) => layer.name === 'authenticate'
  );

  assert.notEqual(internalRouteIndex, -1);
  assert.notEqual(authenticateIndex, -1);
  assert.ok(
    internalRouteIndex < authenticateIndex,
    'internal campaign media resolve route should remain outside user auth/RBAC middleware'
  );
});
