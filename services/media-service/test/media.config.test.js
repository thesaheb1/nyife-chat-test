'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const config = require('../src/config');

test('media uploads default to the shared repo uploads directory', () => {
  assert.equal(
    config.upload.rootDir,
    path.resolve(__dirname, '../../../uploads')
  );
});
