'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const { afterEach } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const models = require('../src/models');
const metaAccessService = require('../src/services/metaAccess.service');

const messageServicePath = require.resolve('../src/services/message.service');
const originalAxiosPost = axios.post;
const originalWaAccountScope = models.WaAccount.scope;
const originalRequireResolvedMetaCredential = metaAccessService.requireResolvedMetaCredential;

afterEach(() => {
  axios.post = originalAxiosPost;
  models.WaAccount.scope = originalWaAccountScope;
  metaAccessService.requireResolvedMetaCredential = originalRequireResolvedMetaCredential;
  delete require.cache[messageServicePath];
});

test('resolveCampaignMediaBindings uploads each unique file once and returns WhatsApp media ids by binding key', async () => {
  const requests = [];

  models.WaAccount.scope = () => ({
    findOne: async () => ({
      id: 'wa-account-1',
      user_id: 'org-1',
      status: 'active',
      phone_number_id: 'phone-number-1',
    }),
  });
  metaAccessService.requireResolvedMetaCredential = () => ({
    accessToken: 'meta-access-token',
  });
  axios.post = async (url, body, options) => {
    requests.push({ url, body, options });
    return {
      data: {
        data: {
          whatsapp_media_id: `wa-media-${body.file_id}`,
        },
      },
    };
  };

  delete require.cache[messageServicePath];
  const messageService = require('../src/services/message.service');

  const resolved = await messageService.resolveCampaignMediaBindings('org-1', 'wa-account-1', {
    header_media: {
      file_id: 'file-1',
      media_type: 'image',
      original_name: 'hero.png',
      mime_type: 'image/png',
      size: 1234,
    },
    card_0_header_media: {
      file_id: 'file-1',
      media_type: 'image',
      original_name: 'hero.png',
      mime_type: 'image/png',
      size: 1234,
    },
    card_1_header_media: {
      file_id: 'file-2',
      media_type: 'video',
      original_name: 'clip.mp4',
      mime_type: 'video/mp4',
      size: 4567,
    },
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.includes('/api/v1/media/upload-to-whatsapp'), true);
  assert.deepEqual(requests[0].options.headers, {
    'x-user-id': 'org-1',
    'x-organization-id': 'org-1',
    'x-wa-access-token': 'meta-access-token',
    'Content-Type': 'application/json',
  });
  assert.deepEqual(resolved, {
    header_media: {
      id: 'wa-media-file-1',
      media_type: 'image',
      original_name: 'hero.png',
      mime_type: 'image/png',
      size: 1234,
    },
    card_0_header_media: {
      id: 'wa-media-file-1',
      media_type: 'image',
      original_name: 'hero.png',
      mime_type: 'image/png',
      size: 1234,
    },
    card_1_header_media: {
      id: 'wa-media-file-2',
      media_type: 'video',
      original_name: 'clip.mp4',
      mime_type: 'video/mp4',
      size: 4567,
    },
  });
});

test('resolveCampaignMediaBindings returns a clear re-upload message when the stored media file is missing', async () => {
  models.WaAccount.scope = () => ({
    findOne: async () => ({
      id: 'wa-account-1',
      user_id: 'org-1',
      status: 'active',
      phone_number_id: 'phone-number-1',
    }),
  });
  metaAccessService.requireResolvedMetaCredential = () => ({
    accessToken: 'meta-access-token',
  });
  axios.post = async () => {
    const error = new Error('Request failed with status code 404');
    error.response = {
      status: 404,
      data: {
        message: 'File not found on disk',
      },
    };
    throw error;
  };

  delete require.cache[messageServicePath];
  const messageService = require('../src/services/message.service');

  await assert.rejects(
    () =>
      messageService.resolveCampaignMediaBindings('org-1', 'wa-account-1', {
        header_media: {
          file_id: 'file-missing',
          media_type: 'document',
          original_name: 'invoice.pdf',
          mime_type: 'application/pdf',
          size: 1024,
        },
      }),
    (error) => {
      assert.equal(
        error.message,
        'The selected campaign media file is no longer available. Please re-upload it and try again.'
      );
      assert.equal(error.code, 'CAMPAIGN_MEDIA_FILE_MISSING');
      return true;
    }
  );
});
