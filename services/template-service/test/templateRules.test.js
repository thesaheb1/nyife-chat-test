'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { assertTemplateBusinessRules } = require('../src/helpers/templateRules');

test('flow template validation allows linked local flow UUIDs to omit navigate_screen', () => {
  assert.doesNotThrow(() => {
    assertTemplateBusinessRules({
      language: 'en_US',
      category: 'MARKETING',
      type: 'flow',
      waba_id: '1468289684238203',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, open the linked flow to continue.',
          example: {
            body_text: [['Ava']],
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'FLOW',
              text: 'Open flow',
              flow_id: 'e9249e26-7e48-4b92-a354-269268908cdb',
              flow_action: 'navigate',
            },
          ],
        },
      ],
    });
  });
});

test('flow template validation still requires navigate_screen for non-local flow references', () => {
  assert.throws(
    () => {
      assertTemplateBusinessRules({
        language: 'en_US',
        category: 'MARKETING',
        type: 'flow',
        waba_id: '1468289684238203',
        components: [
          {
            type: 'BODY',
            text: 'Hello {{1}}, open the linked flow to continue.',
            example: {
              body_text: [['Ava']],
            },
          },
          {
            type: 'BUTTONS',
            buttons: [
              {
                type: 'FLOW',
                text: 'Open flow',
                flow_name: 'remote-flow',
                flow_action: 'navigate',
              },
            ],
          },
        ],
      });
    },
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.ok(
        Array.isArray(error.errors)
        && error.errors.some((detail) => detail.field === 'components.buttons.0.navigate_screen')
      );
      return true;
    }
  );
});
