'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const campaignService = require('../src/services/campaign.service');
const { CampaignMessage } = require('../src/models');

const { __private } = campaignService;
const originalAxiosGet = axios.get;
const originalAxiosPost = axios.post;
const originalCampaignMessageFindOne = CampaignMessage.findOne;

afterEach(() => {
  axios.get = originalAxiosGet;
  axios.post = originalAxiosPost;
  CampaignMessage.findOne = originalCampaignMessageFindOne;
});

test('fetchContactsByIds batches large contact id lists into contact-service sized requests', async () => {
  const requests = [];

  axios.get = async (_url, options) => {
    requests.push(options);
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
  assert.equal(requests[0].params.page, 1);
  assert.equal(requests[0].params.limit, 100);
  assert.equal(requests[0].params.ids.split(',').length, 100);
  assert.equal(requests[1].params.ids.split(',').length, 100);
  assert.equal(requests[2].params.ids.split(',').length, 5);
  assert.equal(contacts.length, 205);
});

test('fetchContactsByTagIds batches large tag id lists into safe requests', async () => {
  const requests = [];

  axios.get = async (_url, options) => {
    requests.push(options);
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
  assert.equal(requests[0].params.tag_ids.split(',').length, 100);
  assert.equal(requests[1].params.tag_ids.split(',').length, 1);
  assert.equal(contacts.length, 2);
});

test('resolveContacts paginates through all contacts, deduplicates, and applies exclude_contact_ids', async () => {
  const requests = [];

  axios.get = async (_url, options) => {
    requests.push(options);

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

  assert.deepEqual(requests.map((request) => request.params.page), [1, 2]);
  assert.deepEqual(contacts.map((contact) => contact.id), ['contact-1', 'contact-3']);
});

test('fetchTemplate forwards actor and organization headers for internal template-service calls', async () => {
  let capturedOptions = null;

  axios.get = async (_url, options) => {
    capturedOptions = options;
    return {
      data: {
        data: {
          template: {
            id: 'template-1',
          },
        },
      },
    };
  };

  await __private.fetchTemplate(
    {
      actorUserId: 'user-1',
      organizationId: 'org-1',
      scopeId: 'org-1',
    },
    'template-1'
  );

  assert.deepEqual(capturedOptions.headers, {
    'x-user-id': 'user-1',
    'x-organization-id': 'org-1',
  });
});

test('fetchContactsByIds forwards actor and organization headers for internal contact-service calls', async () => {
  let capturedOptions = null;

  axios.get = async (_url, options) => {
    capturedOptions = options;
    return {
      data: {
        data: {
          contacts: [{ id: 'contact-1' }],
        },
        meta: {
          totalPages: 1,
        },
      },
    };
  };

  await __private.fetchContactsByIds(
    {
      actorUserId: 'user-1',
      organizationId: 'org-1',
      scopeId: 'org-1',
    },
    ['contact-1']
  );

  assert.deepEqual(capturedOptions.headers, {
    'x-user-id': 'user-1',
    'x-organization-id': 'org-1',
  });
});

test('resolveCampaignMediaBindings forwards internal organization headers to whatsapp-service', async () => {
  let capturedBody = null;
  let capturedOptions = null;

  axios.post = async (_url, body, options) => {
    capturedBody = body;
    capturedOptions = options;
    return {
      data: {
        data: {
          media: {
            header_media: {
              id: 'wa-media-1',
            },
          },
        },
      },
    };
  };

  const media = await __private.resolveCampaignMediaBindings(
    {
      actorUserId: 'user-1',
      organizationId: 'org-1',
      scopeId: 'org-1',
    },
    'wa-account-1',
    {
      header_media: {
        file_id: 'file-1',
        media_type: 'document',
        original_name: 'invoice.pdf',
        mime_type: 'application/pdf',
        size: 2048,
      },
    }
  );

  assert.deepEqual(capturedBody, {
    wa_account_id: 'wa-account-1',
    media_bindings: {
      header_media: {
        file_id: 'file-1',
        media_type: 'document',
        original_name: 'invoice.pdf',
        mime_type: 'application/pdf',
        size: 2048,
      },
    },
  });
  assert.deepEqual(capturedOptions.headers, {
    'x-user-id': 'user-1',
    'x-organization-id': 'org-1',
    'Content-Type': 'application/json',
  });
  assert.deepEqual(media, {
    header_media: {
      id: 'wa-media-1',
    },
  });
});

test('resolveCampaignMediaBindings surfaces downstream permission or validation messages', async () => {
  axios.post = async () => {
    const error = new Error('Request failed with status code 403');
    error.response = {
      status: 403,
      data: {
        message: 'You do not have permission to perform this action in the organization.',
      },
    };
    throw error;
  };

  await assert.rejects(
    () =>
      __private.resolveCampaignMediaBindings(
        {
          actorUserId: 'user-1',
          organizationId: 'org-1',
          scopeId: 'org-1',
        },
        'wa-account-1',
        {
          header_media: {
            file_id: 'file-1',
            media_type: 'document',
            original_name: 'invoice.pdf',
            mime_type: 'application/pdf',
            size: 2048,
          },
        }
      ),
    /You do not have permission to perform this action in the organization\./
  );
});

test('resolveCampaignProductCatalogSupport forwards internal organization headers to whatsapp-service', async () => {
  let capturedBody = null;
  let capturedOptions = null;

  axios.post = async (_url, body, options) => {
    capturedBody = body;
    capturedOptions = options;
    return {
      data: {
        data: {
          product_catalogs: {
            linked: true,
            count: 1,
            items: [{ id: 'catalog-1', name: 'Primary Catalog' }],
          },
        },
      },
    };
  };

  const productCatalogs = await __private.resolveCampaignProductCatalogSupport(
    {
      actorUserId: 'user-1',
      organizationId: 'org-1',
      scopeId: 'org-1',
    },
    'wa-account-1'
  );

  assert.deepEqual(capturedBody, {
    wa_account_id: 'wa-account-1',
  });
  assert.deepEqual(capturedOptions.headers, {
    'x-user-id': 'user-1',
    'x-organization-id': 'org-1',
    'Content-Type': 'application/json',
  });
  assert.deepEqual(productCatalogs, {
    linked: true,
    count: 1,
    items: [{ id: 'catalog-1', name: 'Primary Catalog' }],
  });
});

test('resolveCampaignProductCatalogSupport surfaces downstream validation messages', async () => {
  axios.post = async () => {
    const error = new Error('Request failed with status code 400');
    error.response = {
      status: 400,
      data: {
        message: 'This template requires a linked Meta product catalog.',
      },
    };
    throw error;
  };

  await assert.rejects(
    () =>
      __private.resolveCampaignProductCatalogSupport(
        {
          actorUserId: 'user-1',
          organizationId: 'org-1',
          scopeId: 'org-1',
        },
        'wa-account-1'
      ),
    /This template requires a linked Meta product catalog\./
  );
});

test('getCampaignExecutionDispatchState blocks paused campaigns from dispatching pending messages', async () => {
  CampaignMessage.findOne = async () => ({
    status: 'pending',
    campaign: {
      status: 'paused',
    },
  });

  const result = await campaignService.getCampaignExecutionDispatchState(
    { scopeId: 'org-1' },
    'campaign-1',
    'campaign-message-1'
  );

  assert.deepEqual(result, {
    executable: false,
    reason: 'campaign_paused',
    campaignStatus: 'paused',
    messageStatus: 'pending',
  });
});

test('getCampaignExecutionDispatchState allows running pending messages to dispatch', async () => {
  CampaignMessage.findOne = async () => ({
    status: 'pending',
    campaign: {
      status: 'running',
    },
  });

  const result = await campaignService.getCampaignExecutionDispatchState(
    { scopeId: 'org-1' },
    'campaign-1',
    'campaign-message-1'
  );

  assert.deepEqual(result, {
    executable: true,
    reason: 'ready',
    campaignStatus: 'running',
    messageStatus: 'pending',
  });
});
