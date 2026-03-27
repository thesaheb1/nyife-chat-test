'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compileVisualDefinition,
  convertCanonicalToVisualDefinition,
  createDefaultFlowDefinition,
  validateFlowDefinition,
} = require('../src/helpers/flowSchema');

test('legacy Nyife-style flow JSON normalizes into canonical Meta flow JSON', () => {
  const legacyDefinition = {
    version: '7.1',
    screens: [
      {
        id: 'screen 1',
        title: 'Lead capture',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: 'Tell us about yourself',
            },
            {
              type: 'TextInput',
              name: 'full name',
              label: 'Full name',
              helper_text: 'This field is required',
              required: true,
            },
            {
              type: 'Dropdown',
              name: 'service type',
              label: 'Service type',
              options: [
                { id: 'new', title: 'New customer' },
                { id: 'existing', title: 'Existing customer' },
              ],
            },
            {
              type: 'Footer',
              label: 'Continue',
              action: {
                type: 'navigate',
                target_screen_id: 'screen 2',
              },
            },
          ],
        },
      },
      {
        id: 'screen 2',
        title: 'Done',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextBody',
              text: 'Thanks',
            },
            {
              type: 'Footer',
              label: 'Submit',
              action: {
                type: 'complete',
              },
            },
          ],
        },
      },
    ],
  };

  const result = validateFlowDefinition(legacyDefinition, { name: 'Lead capture' });

  assert.equal(result.visualBuilderSupported, true);
  assert.deepEqual(result.validationErrors, []);
  assert.equal(result.normalized.screens[0].id, 'SCREEN_A');
  assert.equal(result.normalized.screens[0].layout.children[0].type, 'TextHeading');
  assert.equal(result.normalized.screens[0].layout.children[1].type, 'Form');

  const formChildren = result.normalized.screens[0].layout.children[1].children;
  assert.equal(formChildren[0].type, 'TextInput');
  assert.equal(formChildren[0]['helper-text'], 'This field is required');
  assert.equal(Object.prototype.hasOwnProperty.call(formChildren[0], 'placeholder'), false);
  assert.equal(formChildren[1].type, 'Dropdown');
  assert.equal(formChildren[1]['data-source'][0].id, 'new');
  assert.equal(formChildren[2].type, 'Footer');
  assert.equal(formChildren[2]['on-click-action'].name, 'navigate');
  assert.equal(formChildren[2]['on-click-action'].next.name, 'SCREEN_B');
  assert.equal(formChildren[2]['on-click-action'].payload.full_name, '${form.full_name}');
});

test('canonical Meta flow JSON round-trips through the supported visual builder subset', () => {
  const canonicalDefinition = {
    version: '7.1',
    data_api_version: '3.0',
    routing_model: {
      START: ['SCREEN_A'],
      SCREEN_A: ['SCREEN_B'],
    },
    screens: [
      {
        id: 'SCREEN_A',
        title: 'Start',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: 'Welcome',
            },
            {
              type: 'Form',
              name: 'form_screen_a',
              children: [
                {
                  type: 'TextInput',
                  name: 'email_address',
                  label: 'Email',
                  required: true,
                  'helper-text': 'Use a work email',
                },
                {
                  type: 'Footer',
                  label: 'Next',
                  'on-click-action': {
                    name: 'navigate',
                    next: { name: 'SCREEN_B' },
                    payload: {
                      email_address: '${form.email_address}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'SCREEN_B',
        title: 'Done',
        terminal: true,
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'form_screen_b',
              children: [
                {
                  type: 'Footer',
                  label: 'Submit',
                  'on-click-action': {
                    name: 'complete',
                    payload: {},
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const builderState = convertCanonicalToVisualDefinition(canonicalDefinition);
  assert.equal(builderState.supported, true);
  assert.equal(builderState.visualDefinition.screens[0].layout.children[1].type, 'TextInput');
  assert.equal(builderState.visualDefinition.screens[0].layout.children[2].type, 'Footer');

  const rebuilt = compileVisualDefinition(builderState.visualDefinition, { name: 'Start' }).metaDefinition;
  const rebuiltForm = rebuilt.screens[0].layout.children[1];
  assert.equal(rebuiltForm.type, 'Form');
  assert.equal(rebuiltForm.children[0].type, 'TextInput');
  assert.equal(rebuiltForm.children[1].type, 'Footer');
  assert.equal(rebuiltForm.children[1]['on-click-action'].next.name, 'SCREEN_B');
});

test('unsupported canonical Meta flow JSON stays JSON-only instead of being forced through the builder', () => {
  const unsupportedDefinition = {
    version: '7.1',
    screens: [
      {
        id: 'SCREEN_ADVANCED',
        title: 'Advanced',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'form_advanced',
              children: [
                {
                  type: 'OptIn',
                  name: 'marketing_opt_in',
                  label: 'Marketing opt-in',
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const result = validateFlowDefinition(unsupportedDefinition, { name: 'Advanced' });

  assert.equal(result.visualBuilderSupported, false);
  assert.match(result.visualBuilderWarning, /visual builder/i);
  assert.equal(result.normalized.screens[0].layout.children[0].children[0].type, 'OptIn');
});

test('default starter flow definitions are Meta-safe for every official category', () => {
  const categories = [
    'SIGN_UP',
    'SIGN_IN',
    'LEAD_GENERATION',
    'APPOINTMENT_BOOKING',
    'CONTACT_US',
    'CUSTOMER_SUPPORT',
    'SURVEY',
    'OTHER',
  ];

  for (const category of categories) {
    const definition = createDefaultFlowDefinition(`${category} starter`, [category]);
    const validation = validateFlowDefinition(definition, {
      name: `${category} starter`,
      categories: [category],
    });

    assert.deepEqual(validation.validationErrors, [], `expected no local validation errors for ${category}`);
    assert.match(validation.normalized.screens[0].id, /^[A-Z_]+$/);

    const layoutChildren = validation.normalized.screens[0].layout.children;
    const form = layoutChildren.find((component) => component.type === 'Form');
    assert.ok(form, `expected a Form wrapper for ${category}`);

    const formChildren = Array.isArray(form.children) ? form.children : [];
    for (const child of formChildren) {
      if (child.name) {
        assert.match(child.name, /^[a-z_]+$/);
      }
      if (Array.isArray(child['data-source'])) {
        child['data-source'].forEach((option) => {
          assert.match(option.id, /^[a-z_]+$/);
        });
      }
      assert.equal(Object.prototype.hasOwnProperty.call(child, 'placeholder'), false);
    }
  }
});
