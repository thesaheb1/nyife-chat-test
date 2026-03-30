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

test('published flows expose clone and deprecate actions only', () => {
  assert.deepEqual(getFlowAvailableActions('PUBLISHED'), ['view', 'clone', 'deprecate']);
  assert.equal(canEditFlow('PUBLISHED'), false);
  assert.equal(canPublishFlow('PUBLISHED'), false);
  assert.equal(canDeleteFlow('PUBLISHED'), false);
  assert.equal(canCloneFlow('PUBLISHED'), true);
  assert.equal(canDeprecateFlow('PUBLISHED'), true);
});

test('throttled and blocked flows expose clone-only lifecycle actions after view', () => {
  for (const status of ['THROTTLED', 'BLOCKED']) {
    assert.deepEqual(getFlowAvailableActions(status), ['view', 'clone']);
    assert.equal(canEditFlow(status), false);
    assert.equal(canPublishFlow(status), false);
    assert.equal(canDeleteFlow(status), false);
    assert.equal(canCloneFlow(status), true);
    assert.equal(canDeprecateFlow(status), false);
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
