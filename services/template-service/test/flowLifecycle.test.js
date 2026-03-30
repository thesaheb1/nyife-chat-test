'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFlowAvailableActions,
  normalizeFlowLifecycleStatus,
  canEditFlow,
  canPublishFlow,
  canDeleteFlow,
  canCloneFlow,
  canDeprecateFlow,
} = require('../src/helpers/flowLifecycle');

test('normalizeFlowLifecycleStatus maps Meta lifecycle states into local statuses', () => {
  assert.equal(normalizeFlowLifecycleStatus('draft'), 'DRAFT');
  assert.equal(normalizeFlowLifecycleStatus('published'), 'PUBLISHED');
  assert.equal(normalizeFlowLifecycleStatus('throttled'), 'THROTTLED');
  assert.equal(normalizeFlowLifecycleStatus('blocked'), 'BLOCKED');
  assert.equal(normalizeFlowLifecycleStatus('deprecated'), 'DEPRECATED');
});

test('draft flows expose edit publish and delete actions', () => {
  assert.deepEqual(getFlowAvailableActions('DRAFT'), ['view', 'edit', 'publish', 'delete']);
  assert.equal(canEditFlow('DRAFT'), true);
  assert.equal(canPublishFlow('DRAFT'), true);
  assert.equal(canDeleteFlow('DRAFT'), true);
  assert.equal(canCloneFlow('DRAFT'), false);
  assert.equal(canDeprecateFlow('DRAFT'), false);
});

test('published-like flows expose clone and deprecate actions only', () => {
  for (const status of ['PUBLISHED', 'THROTTLED', 'BLOCKED']) {
    assert.deepEqual(getFlowAvailableActions(status), ['view', 'clone', 'deprecate']);
    assert.equal(canEditFlow(status), false);
    assert.equal(canPublishFlow(status), false);
    assert.equal(canDeleteFlow(status), false);
    assert.equal(canCloneFlow(status), true);
    assert.equal(canDeprecateFlow(status), true);
  }
});

test('deprecated flows only expose clone after view', () => {
  assert.deepEqual(getFlowAvailableActions('DEPRECATED'), ['view', 'clone']);
  assert.equal(canEditFlow('DEPRECATED'), false);
  assert.equal(canPublishFlow('DEPRECATED'), false);
  assert.equal(canDeleteFlow('DEPRECATED'), false);
  assert.equal(canCloneFlow('DEPRECATED'), true);
  assert.equal(canDeprecateFlow('DEPRECATED'), false);
});
