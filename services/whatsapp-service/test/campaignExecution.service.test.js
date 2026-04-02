'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('node:assert/strict');
const test = require('node:test');

const campaignExecutionService = require('../src/services/campaignExecution.service');

test('processCampaignExecuteMessage publishes immediate campaign and WhatsApp queued statuses after a successful send', async () => {
  const publishedEvents = [];

  const result = await campaignExecutionService.processCampaignExecuteMessage(
    {
      userId: 'org-1',
      waAccountId: 'wa-1',
      phoneNumber: '+15551234567',
      contactId: 'contact-1',
      campaignId: 'campaign-1',
      templateName: 'just_testing',
      templateLanguage: 'en',
      templateCategory: 'MARKETING',
      components: [],
    },
        {
          kafkaProducer: { id: 'producer-1' },
          loadDispatchState: async () => ({ executable: true, reason: 'ready' }),
          sendCampaignMessage: async () => ({
            id: 'wa-message-1',
            meta_message_id: 'wamid-1',
        status: 'sent',
      }),
      accountLookup: async () => ({
        id: 'wa-1',
        user_id: 'org-1',
        waba_id: 'waba-1',
        phone_number_id: 'phone-number-1',
      }),
      publishEventFn: async (_producer, topic, key, payload) => {
        publishedEvents.push({ topic, key, payload });
      },
    }
  );

  assert.equal(result.status, 'sent');
  assert.equal(publishedEvents.length, 2);
  assert.equal(publishedEvents[0].key, 'campaign-1');
  assert.equal(publishedEvents[0].payload.contactId, 'contact-1');
  assert.equal(publishedEvents[0].payload.messageId, 'wamid-1');
  assert.equal(publishedEvents[0].payload.status, 'queued');
  assert.equal(publishedEvents[1].key, 'wamid-1');
  assert.equal(publishedEvents[1].payload.status, 'queued');
  assert.equal(publishedEvents[1].payload.waAccountId, 'wa-1');
  assert.equal(publishedEvents[1].payload.metaMessageId, 'wamid-1');
});

test('processCampaignExecuteMessage publishes an immediate failed status when sending throws', async () => {
  const publishedEvents = [];

  await assert.rejects(
    () =>
      campaignExecutionService.processCampaignExecuteMessage(
        {
          userId: 'org-1',
          waAccountId: 'wa-1',
          phoneNumber: '+15551234567',
          contactId: 'contact-1',
          campaignId: 'campaign-1',
          templateName: 'just_testing',
          templateLanguage: 'en',
          components: [],
        },
        {
          kafkaProducer: { id: 'producer-1' },
          loadDispatchState: async () => ({ executable: true, reason: 'ready' }),
          sendCampaignMessage: async () => {
            throw new Error('Meta send failed');
          },
          publishEventFn: async (_producer, topic, key, payload) => {
            publishedEvents.push({ topic, key, payload });
          },
        }
      ),
    /Meta send failed/
  );

  assert.equal(publishedEvents.length, 1);
  assert.equal(publishedEvents[0].payload.contactId, 'contact-1');
  assert.equal(publishedEvents[0].payload.status, 'failed');
  assert.equal(publishedEvents[0].payload.errorMessage, 'Meta send failed');
});

test('processCampaignExecuteMessage skips sending when campaign execution is paused or otherwise not executable', async () => {
  let sendAttempted = false;

  const result = await campaignExecutionService.processCampaignExecuteMessage(
    {
      userId: 'org-1',
      waAccountId: 'wa-1',
      phoneNumber: '+15551234567',
      contactId: 'contact-1',
      campaignId: 'campaign-1',
      campaignMessageId: 'campaign-message-1',
      templateName: 'just_testing',
      templateLanguage: 'en',
      components: [],
    },
    {
      loadDispatchState: async () => ({
        executable: false,
        reason: 'campaign_paused',
        campaignStatus: 'paused',
        messageStatus: 'pending',
      }),
      sendCampaignMessage: async () => {
        sendAttempted = true;
      },
    }
  );

  assert.equal(sendAttempted, false);
  assert.deepEqual(result, {
    skipped: true,
    reason: 'campaign_paused',
    campaignStatus: 'paused',
    messageStatus: 'pending',
  });
});
