'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const templateService = require('../src/services/template.service');
const { Template } = require('../src/models');

const originalFindAndCountAll = Template.findAndCountAll;

afterEach(() => {
  Template.findAndCountAll = originalFindAndCountAll;
});

test('listTemplates applies published_only without dropping other filters', async () => {
  let capturedQuery = null;

  Template.findAndCountAll = async (query) => {
    capturedQuery = query;
    return {
      count: 1,
      rows: [
        {
          id: 'template-1',
          user_id: 'user-1',
          name: 'promo_template',
          display_name: 'Promo template',
          language: 'en',
          category: 'MARKETING',
          type: 'standard',
          status: 'approved',
          components: [],
          meta_template_id: 'meta-template-1',
          created_at: new Date('2026-03-01T00:00:00Z'),
          updated_at: new Date('2026-03-01T00:00:00Z'),
        },
      ],
    };
  };

  const result = await templateService.listTemplates('user-1', {
    page: 1,
    limit: 20,
    status: 'approved',
    published_only: true,
    waba_id: 'waba-1',
  });

  assert.equal(capturedQuery.where.user_id, 'user-1');
  assert.equal(capturedQuery.where.status, 'approved');
  assert.equal(capturedQuery.where.waba_id, 'waba-1');
  assert.deepEqual(capturedQuery.where.meta_template_id, { [Op.not]: null });
  assert.equal(result.templates.length, 1);
  assert.equal(result.meta.total, 1);
});
