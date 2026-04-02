'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyVariablesMapping,
  buildPersistedTemplateBindings,
  extractTemplateBindingRequirements,
  normalizeStoredTemplateBindings,
  pruneTemplateBindings,
  validateTemplateBindings,
} = require('../src/helpers/templateBindings');

test('extractTemplateBindingRequirements finds variable, media, location, and product inputs across template components', () => {
  const requirements = extractTemplateBindingRequirements({
    components: [
      { type: 'HEADER', format: 'IMAGE' },
      { type: 'HEADER', format: 'LOCATION' },
      { type: 'BODY', text: 'Hello {{1}} {{2}}' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', url: 'https://example.com/{{1}}' }],
      },
      {
        type: 'CAROUSEL',
        cards: [
          {
            components: [
              { type: 'HEADER', format: 'VIDEO' },
              { type: 'HEADER', format: 'PRODUCT' },
              { type: 'BODY', text: 'Card body {{1}}' },
              {
                type: 'BUTTONS',
                buttons: [
                  { type: 'URL', url: 'https://example.com/card/{{1}}' },
                  { type: 'SPM', text: 'View' },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    requirements.variables.map((field) => field.key),
    ['body_1', 'body_2', 'button_url_0', 'card_0_body_1', 'card_0_button_url_0']
  );
  assert.deepEqual(
    requirements.media.map((field) => [field.key, field.format]),
    [['header_media', 'IMAGE'], ['card_0_header_media', 'VIDEO']]
  );
  assert.deepEqual(
    requirements.locations.map((field) => field.key),
    ['header_location']
  );
  assert.deepEqual(
    requirements.products.map((field) => field.key),
    ['card_0_header_product']
  );
  assert.equal(requirements.requires_catalog_support, true);
});

test('normalizeStoredTemplateBindings falls back to legacy variable mappings while preserving media', () => {
  const normalized = normalizeStoredTemplateBindings(
    {
      media: {
        header_media: {
          file_id: 'file-1',
          media_type: 'image',
          original_name: 'hero.png',
          mime_type: 'image/png',
          size: 1024,
        },
      },
    },
    {
      body_1: { mode: 'dynamic', source: 'full_name' },
    }
  );

  assert.deepEqual(normalized.variables, {
    body_1: { mode: 'dynamic', source: 'full_name' },
  });
  assert.deepEqual(Object.keys(normalized.media), ['header_media']);
});

test('pruneTemplateBindings drops bindings that are no longer required by the template', () => {
  const pruned = pruneTemplateBindings(
    {
      variables: {
        body_1: { mode: 'static', value: 'hello' },
        body_2: { mode: 'static', value: 'drop me' },
      },
      media: {
        header_media: {
          file_id: 'file-1',
          media_type: 'image',
          original_name: 'hero.png',
          mime_type: 'image/png',
          size: 1024,
        },
        card_1_header_media: {
          file_id: 'file-2',
          media_type: 'video',
          original_name: 'card.mp4',
          mime_type: 'video/mp4',
          size: 2048,
        },
      },
      products: {
        card_0_header_product: {
          product_retailer_id: 'prod-1',
        },
        card_1_header_product: {
          product_retailer_id: 'prod-2',
        },
      },
    },
    {
      variables: [{ key: 'body_1' }],
      media: [{ key: 'header_media' }],
      products: [{ key: 'card_0_header_product' }],
    }
  );

  assert.deepEqual(pruned.variables, {
    body_1: { mode: 'static', value: 'hello' },
  });
  assert.deepEqual(Object.keys(pruned.media), ['header_media']);
  assert.deepEqual(Object.keys(pruned.products), ['card_0_header_product']);
});

test('validateTemplateBindings marks incomplete variable, media, location, and product inputs clearly', () => {
  const validation = validateTemplateBindings(
    {
      variables: [{ key: 'body_1', label: 'Body variable 1' }],
      media: [{ key: 'header_media', label: 'Header media' }],
      locations: [{ key: 'header_location', label: 'Header location' }],
      products: [{ key: 'card_0_header_product', label: 'Card 1 product' }],
    },
    {
      variables: {},
      media: {},
      locations: {},
      products: {},
    }
  );

  assert.equal(validation.isComplete, false);
  assert.deepEqual(validation.issues, [
    {
      field: 'template_bindings.variables.body_1',
      message: 'Body variable 1 is required.',
    },
    {
      field: 'template_bindings.media.header_media',
      message: 'Header media is required.',
    },
    {
      field: 'template_bindings.locations.header_location',
      message: 'Header location is required.',
    },
    {
      field: 'template_bindings.products.card_0_header_product',
      message: 'Card 1 product is required.',
    },
  ]);
});

test('buildPersistedTemplateBindings and buildLegacyVariablesMapping keep compatibility aligned', () => {
  const templateBindings = buildPersistedTemplateBindings({
    variables: {
      body_1: { mode: 'dynamic', source: 'email' },
    },
    media: {
      header_media: {
        file_id: 'file-1',
        media_type: 'document',
        original_name: 'offer.pdf',
        mime_type: 'application/pdf',
        size: 4096,
      },
    },
    locations: {
      header_location: {
        latitude: 28.6139,
        longitude: 77.209,
        name: 'Delhi',
      },
    },
    products: {
      card_0_header_product: {
        product_retailer_id: 'sku-123',
      },
    },
  });

  assert.deepEqual(templateBindings, {
    variables: {
      body_1: { mode: 'dynamic', source: 'email' },
    },
    media: {
      header_media: {
        file_id: 'file-1',
        media_type: 'document',
        original_name: 'offer.pdf',
        mime_type: 'application/pdf',
        size: 4096,
      },
    },
    locations: {
      header_location: {
        latitude: 28.6139,
        longitude: 77.209,
        name: 'Delhi',
      },
    },
    products: {
      card_0_header_product: {
        product_retailer_id: 'sku-123',
      },
    },
  });
  assert.deepEqual(buildLegacyVariablesMapping(templateBindings), {
    body_1: { mode: 'dynamic', source: 'email' },
  });
});
