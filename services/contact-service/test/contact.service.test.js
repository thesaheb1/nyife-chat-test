'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const contactService = require('../src/services/contact.service');
const { Group, Tag } = require('../src/models');

const originalTagFindAll = Tag.findAll;
const originalTagFindAndCountAll = Tag.findAndCountAll;
const originalGroupFindAndCountAll = Group.findAndCountAll;

afterEach(() => {
  Tag.findAll = originalTagFindAll;
  Tag.findAndCountAll = originalTagFindAndCountAll;
  Group.findAndCountAll = originalGroupFindAndCountAll;
});

test('listTags keeps legacy full-list behavior when no filters are supplied', async () => {
  let findAllQuery = null;

  Tag.findAll = async (query) => {
    findAllQuery = query;
    return [{ id: 'tag-1', name: 'VIP' }];
  };
  Tag.findAndCountAll = async () => {
    throw new Error('Expected full-list mode to avoid pagination query');
  };

  const result = await contactService.listTags('user-1');

  assert.equal(findAllQuery.where.user_id, 'user-1');
  assert.equal(result.meta, null);
  assert.equal(result.tags.length, 1);
});

test('listTags supports pagination, search, and ids filters together', async () => {
  let pagedQuery = null;

  Tag.findAll = async () => {
    throw new Error('Expected paginated mode to use findAndCountAll');
  };
  Tag.findAndCountAll = async (query) => {
    pagedQuery = query;
    return {
      count: 2,
      rows: [{ id: 'tag-1', name: 'VIP' }],
    };
  };

  const result = await contactService.listTags('user-1', {
    page: 2,
    limit: 10,
    search: 'VIP',
    ids: 'tag-1, tag-2',
  });

  assert.equal(pagedQuery.where.user_id, 'user-1');
  assert.deepEqual(pagedQuery.where.id, { [Op.in]: ['tag-1', 'tag-2'] });
  assert.deepEqual(pagedQuery.where.name, { [Op.like]: '%VIP%' });
  assert.equal(pagedQuery.offset, 10);
  assert.equal(pagedQuery.limit, 10);
  assert.equal(result.meta.page, 2);
  assert.equal(result.meta.limit, 10);
  assert.equal(result.meta.total, 2);
});

test('listGroups supports hydrating specific ids outside the current page', async () => {
  let capturedQuery = null;

  Group.findAndCountAll = async (query) => {
    capturedQuery = query;
    return {
      count: 2,
      rows: [{ id: 'group-1' }, { id: 'group-2' }],
    };
  };

  const result = await contactService.listGroups('user-1', {
    page: 1,
    limit: 20,
    ids: 'group-1, group-2',
  });

  assert.equal(capturedQuery.where.user_id, 'user-1');
  assert.deepEqual(capturedQuery.where.id, { [Op.in]: ['group-1', 'group-2'] });
  assert.equal(result.groups.length, 2);
  assert.equal(result.meta.total, 2);
});
