'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const campaignService = require('../src/services/campaign.service');

const { __private } = campaignService;
const originalAxiosGet = axios.get;

afterEach(() => {
  axios.get = originalAxiosGet;
});

test('fetchContactsByIds batches large contact id lists into contact-service sized requests', async () => {
  const requests = [];

  axios.get = async (_url, options) => {
    requests.push(options.params);
    return {
      data: {
        data: {
          contacts: options.params.ids.split(',').map((id) => ({ id })),
        },
        meta: {
          totalPages: 1,
        },
      },
    };
  };

  const contactIds = Array.from({ length: 205 }, (_, index) => `contact-${index + 1}`);
  const contacts = await __private.fetchContactsByIds('user-1', contactIds);

  assert.equal(requests.length, 3);
  assert.equal(requests[0].page, 1);
  assert.equal(requests[0].limit, 100);
  assert.equal(requests[0].ids.split(',').length, 100);
  assert.equal(requests[1].ids.split(',').length, 100);
  assert.equal(requests[2].ids.split(',').length, 5);
  assert.equal(contacts.length, 205);
});

test('fetchContactsByTagIds batches large tag id lists into safe requests', async () => {
  const requests = [];

  axios.get = async (_url, options) => {
    requests.push(options.params);
    return {
      data: {
        data: {
          contacts: [{ id: `batch-${requests.length}` }],
        },
        meta: {
          totalPages: 1,
        },
      },
    };
  };

  const tagIds = Array.from({ length: 101 }, (_, index) => `tag-${index + 1}`);
  const contacts = await __private.fetchContactsByTagIds('user-1', tagIds);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].tag_ids.split(',').length, 100);
  assert.equal(requests[1].tag_ids.split(',').length, 1);
  assert.equal(contacts.length, 2);
});

test('resolveContacts paginates through all contacts, deduplicates, and applies exclude_contact_ids', async () => {
  const requests = [];

  axios.get = async (_url, options) => {
    requests.push(options.params);

    if (options.params.page === 1) {
      return {
        data: {
          data: {
            contacts: [{ id: 'contact-1' }, { id: 'contact-2' }],
          },
          meta: {
            totalPages: 2,
          },
        },
      };
    }

    return {
      data: {
        data: {
          contacts: [{ id: 'contact-2' }, { id: 'contact-3' }],
        },
        meta: {
          totalPages: 2,
        },
      },
    };
  };

  const contacts = await __private.resolveContacts('user-1', 'all', {
    exclude_contact_ids: ['contact-2'],
  });

  assert.deepEqual(requests.map((params) => params.page), [1, 2]);
  assert.deepEqual(contacts.map((contact) => contact.id), ['contact-1', 'contact-3']);
});
