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

test('buildTemplateComponents supports top-level and carousel media headers', () => {
  const template = {
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
      },
      {
        type: 'CAROUSEL',
        cards: [
          {
            components: [
              {
                type: 'HEADER',
                format: 'IMAGE',
              },
            ],
          },
        ],
      },
    ],
  };

  const components = buildTemplateComponents(
    template,
    {},
    {
      header_media: { id: 'doc-media-id', media_type: 'document' },
      card_0_header_media: { id: 'image-media-id', media_type: 'image' },
    }
  );

  assert.deepEqual(components, [
    {
      type: 'header',
      parameters: [
        {
          type: 'document',
          document: {
            id: 'doc-media-id',
          },
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
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: {
                    id: 'image-media-id',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
});

test('buildTemplateComponents supports location headers and product carousel cards', () => {
  const template = {
    components: [
      {
        type: 'HEADER',
        format: 'LOCATION',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}}',
      },
      {
        type: 'CAROUSEL',
        cards: [
          {
            components: [
              {
                type: 'HEADER',
                format: 'PRODUCT',
              },
              {
                type: 'BUTTONS',
                buttons: [
                  {
                    type: 'SPM',
                    text: 'View',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const components = buildTemplateComponents(
    template,
    {
      body_1: 'Pablo',
    },
    {},
    {
      header_location: {
        latitude: 28.6139,
        longitude: 77.209,
        name: 'Delhi',
        address: 'India Gate',
      },
    },
    {
      card_0_header_product: {
        product_retailer_id: 'sku-001',
      },
    }
  );

  assert.deepEqual(components, [
    {
      type: 'header',
      parameters: [
        {
          type: 'location',
          location: {
            latitude: '28.6139',
            longitude: '77.209',
            name: 'Delhi',
            address: 'India Gate',
          },
        },
      ],
    },
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: 'Pablo',
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
              type: 'header',
              parameters: [
                {
                  type: 'product',
                  product: {
                    product_retailer_id: 'sku-001',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
});

test('buildTemplateComponents supports top-level product headers without re-sending static commerce buttons', () => {
  const template = {
    components: [
      {
        type: 'HEADER',
        format: 'PRODUCT',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'SPM',
            text: 'View product',
          },
        ],
      },
    ],
  };

  const components = buildTemplateComponents(
    template,
    {},
    {},
    {},
    {
      header_product: {
        product_retailer_id: 'sku-top-1',
      },
    }
  );

  assert.deepEqual(components, [
    {
      type: 'header',
      parameters: [
        {
          type: 'product',
          product: {
            product_retailer_id: 'sku-top-1',
          },
        },
      ],
    },
  ]);
});
