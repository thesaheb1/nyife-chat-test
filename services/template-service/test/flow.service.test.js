'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const flowService = require('../src/services/flow.service');

const { __private } = flowService;

test('Meta create payload uses documented static-flow fields and preserves clone lineage', () => {
  const payload = __private.buildMetaFlowCreatePayload({
    name: 'Lead capture flow',
    categories: ['LEAD_GENERATION'],
    cloned_from_meta_flow_id: 'flow-meta-123',
    json_definition: {
      data_api_version: '3.0',
    },
  });

  assert.deepEqual(payload, {
    name: 'Lead capture flow',
    categories: ['LEAD_GENERATION'],
    clone_flow_id: 'flow-meta-123',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'waba_id'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'data_api_version'), false);
});

test('Meta metadata form only contains documented metadata fields for static flows', () => {
  const form = __private.buildMetaMetadataForm({
    name: 'Support request flow',
    categories: ['CUSTOMER_SUPPORT'],
    json_definition: {
      data_api_version: '3.0',
    },
  });

  assert.equal(form.get('name'), 'Support request flow');
  assert.equal(form.get('categories'), '["CUSTOMER_SUPPORT"]');
  assert.equal(form.get('data_api_version'), null);
  assert.equal(form.get('endpoint_uri'), null);
});

test('flow JSON upload form uses multipart flow.json asset payload', async () => {
  const form = __private.buildFlowJsonForm({
    json_definition: {
      version: '7.1',
      screens: [],
    },
  });

  assert.equal(form.get('name'), 'flow.json');
  assert.equal(form.get('asset_type'), 'FLOW_JSON');

  const file = form.get('file');
  assert.ok(file instanceof Blob);
  assert.equal(file.type, 'application/json');
  assert.equal(await file.text(), JSON.stringify({ version: '7.1', screens: [] }));
});

test('remote state patch maps preview validation and blocked health correctly', () => {
  const previewExpiresAt = '2026-03-30T12:30:00+0000';
  const patch = __private.buildRemoteStatePatch({
    status: 'BLOCKED',
    preview: {
      preview_url: 'https://business.facebook.com/wa/manage/flows/demo/preview/?token=abc',
      expires_at: previewExpiresAt,
    },
    validation_errors: [
      {
        code: 'INVALID_PROPERTY',
        message: 'Unsupported property',
        line: 4,
        column: 9,
        path: 'screens[0].layout.children[1]',
      },
    ],
    health_status: {
      can_send_message: false,
    },
  });

  assert.equal(patch.status, 'BLOCKED');
  assert.equal(patch.meta_status, 'BLOCKED');
  assert.equal(patch.preview_url, 'https://business.facebook.com/wa/manage/flows/demo/preview/?token=abc');
  assert.ok(patch.preview_expires_at instanceof Date);
  assert.equal(patch.preview_expires_at.toISOString(), new Date(previewExpiresAt).toISOString());
  assert.equal(patch.can_send_message, false);
  assert.equal(patch.validation_errors[0], 'Unsupported property (line 4, column 9)');
  assert.equal(patch.validation_error_details[0].path, 'screens[0].layout.children[1]');
  assert.equal(patch.has_local_changes, false);
});

test('remote state patch maps string sendability values from Meta health payloads', () => {
  const availablePatch = __private.buildRemoteStatePatch({
    status: 'PUBLISHED',
    health_status: {
      can_send_message: 'AVAILABLE',
    },
  });
  const blockedPatch = __private.buildRemoteStatePatch({
    status: 'BLOCKED',
    health_status: {
      can_send_message: 'BLOCKED',
    },
  });

  assert.equal(availablePatch.can_send_message, true);
  assert.equal(blockedPatch.can_send_message, false);
});

test('normalized persisted flow responses always include server lifecycle actions', () => {
  const normalized = __private.normalizeFlowForResponse({
    id: 'flow-1',
    categories: ['SURVEY'],
    status: 'THROTTLED',
    preview_url: '/flows/local-preview',
  });

  assert.deepEqual(normalized.available_actions, ['view', 'clone']);
  assert.equal(normalized.preview_url, null);
});
