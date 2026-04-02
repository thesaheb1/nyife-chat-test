'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../src/routes/media.routes');

test('internal media routes are registered before organizationResolver middleware', () => {
  const uploadToWhatsAppIndex = router.stack.findIndex(
    (layer) => layer.route?.path === '/upload-to-whatsapp'
  );
  const downloadFromWhatsAppIndex = router.stack.findIndex(
    (layer) => layer.route?.path === '/whatsapp/:mediaId'
  );
  const organizationResolverIndex = router.stack.findIndex(
    (layer) => layer.name === 'organizationResolver'
  );

  assert.notEqual(uploadToWhatsAppIndex, -1);
  assert.notEqual(downloadFromWhatsAppIndex, -1);
  assert.notEqual(organizationResolverIndex, -1);
  assert.ok(
    uploadToWhatsAppIndex < organizationResolverIndex,
    'upload-to-whatsapp should remain outside tenant resolution middleware'
  );
  assert.ok(
    downloadFromWhatsAppIndex < organizationResolverIndex,
    'download-from-whatsapp should remain outside tenant resolution middleware'
  );
});
