'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTemplateComponents,
  resolveVariables,
} = require('../src/helpers/variableResolver');

test('resolveVariables supports legacy paths and structured dynamic/static bindings', () => {
  const contact = {
    whatsapp_name: 'Fallback Name',
    email: 'contact@example.com',
    phone: '+15551234567',
    custom_fields: {
      city: 'Lahore',
    },
  };

  const resolved = resolveVariables(contact, {
    body_1: { mode: 'dynamic', source: 'full_name' },
    header_1: { mode: 'dynamic', source: 'email' },
    button_url_0: { mode: 'static', value: 'promo-2026' },
    city_label: 'custom_fields.city',
  });

  assert.equal(resolved.body_1, 'Fallback Name');
  assert.equal(resolved.header_1, 'contact@example.com');
  assert.equal(resolved.button_url_0, 'promo-2026');
  assert.equal(resolved.city_label, 'Lahore');
});

test('buildTemplateComponents supports legacy body keys, url buttons, and carousel card variables', () => {
  const template = {
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Hello {{1}}',
      },
      {
        type: 'BODY',
        text: 'Body {{1}}',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            url: 'https://example.com/{{1}}',
          },
        ],
      },
      {
        type: 'CAROUSEL',
        cards: [
          {
            components: [
              {
                type: 'BODY',
                text: 'Card body {{1}}',
              },
              {
                type: 'BUTTONS',
                buttons: [
                  {
                    type: 'URL',
                    url: 'https://example.com/card/{{1}}',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const components = buildTemplateComponents(template, {
    header_1: 'Welcome',
    1: 'Legacy body value',
    button_url_0: 'top-button',
    card_0_body_1: 'Card value',
    card_0_button_url_0: 'card-button',
  });

  assert.deepEqual(components, [
    {
      type: 'header',
      parameters: [
        {
          type: 'text',
          text: 'Welcome',
        },
      ],
    },
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: 'Legacy body value',
        },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [
        {
          type: 'text',
          text: 'top-button',
        },
      ],
    },
    {
      type: 'carousel',
      cards: [
        {
          card_index: 0,
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: 'Card value',
                },
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                {
                  type: 'text',
                  text: 'card-button',
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
});
