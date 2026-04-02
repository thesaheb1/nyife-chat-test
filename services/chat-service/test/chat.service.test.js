'use strict';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const axios = require('axios');
const { UniqueConstraintError } = require('sequelize');

const chatService = require('../src/services/chat.service');
const { Conversation, ChatMessage, sequelize } = require('../src/models');

const originalAxiosPost = axios.post;
const originalConversationFindOne = Conversation.findOne;
const originalConversationFindOrCreate = Conversation.findOrCreate;
const originalConversationFindByPk = Conversation.findByPk;
const originalChatMessageFindOne = ChatMessage.findOne;
const originalChatMessageCreate = ChatMessage.create;
const originalSequelizeQuery = sequelize.query;

afterEach(() => {
  axios.post = originalAxiosPost;
  Conversation.findOne = originalConversationFindOne;
  Conversation.findOrCreate = originalConversationFindOrCreate;
  Conversation.findByPk = originalConversationFindByPk;
  ChatMessage.findOne = originalChatMessageFindOne;
  ChatMessage.create = originalChatMessageCreate;
  sequelize.query = originalSequelizeQuery;
});

test('sendMessage forwards actor and organization headers to whatsapp-service and keeps the chat message pending until webhook status arrives', async () => {
  const createdMessages = [];
  const conversation = {
    id: 'conversation-1',
    wa_account_id: 'wa-1',
    contact_phone: '+918800281734',
    assigned_to: null,
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };

  let capturedRequest = null;

  Conversation.findOne = async () => conversation;
  ChatMessage.create = async (values) => {
    const message = {
      id: 'chat-message-1',
      ...values,
      async update(updateValues) {
        Object.assign(this, updateValues);
        return this;
      },
      async reload() {
        return this;
      },
      toJSON() {
        return { ...this };
      },
    };
    createdMessages.push(message);
    return message;
  };
  sequelize.query = async (sql) => {
    if (sql.includes('FROM wa_accounts')) {
      return [
        {
          id: 'wa-1',
          user_id: 'org-1',
          status: 'active',
        },
      ];
    }

    return [];
  };
  axios.post = async (url, body, options) => {
    capturedRequest = { url, body, options };
    return {
      data: {
        data: {
          message: {
            id: 'wa-message-1',
            meta_message_id: 'wamid-1',
          },
        },
      },
    };
  };

  const result = await chatService.sendMessage(
    'org-1',
    { userId: 'user-1', role: 'owner' },
    {
      actorUserId: 'user-1',
      organizationId: 'org-1',
      scopeId: 'org-1',
    },
    'conversation-1',
    {
      type: 'text',
      message: { body: 'Hello from chat' },
      wa_account_id: 'wa-1',
    },
    null
  );

  assert.equal(capturedRequest.options.headers['x-user-id'], 'user-1');
  assert.equal(capturedRequest.options.headers['x-organization-id'], 'org-1');
  assert.equal(createdMessages[0].status, 'pending');
  assert.equal(result.status, 'pending');
  assert.equal(result.meta_message_id, 'wamid-1');
});

test('handleStatusUpdate creates a missing outbound chat message for campaign messages', async () => {
  const createdMessages = [];
  const conversation = {
    id: 'conversation-1',
    contact_name: null,
    async update(values) {
      Object.assign(this, values);
      return this;
    },
    async reload() {
      return this;
    },
  };

  ChatMessage.findOne = async ({ where }) =>
    createdMessages.find((message) => message.meta_message_id === where.meta_message_id) || null;
  ChatMessage.create = async (values) => {
    const message = {
      id: 'chat-message-1',
      ...values,
      async update(updateValues) {
        Object.assign(this, updateValues);
        return this;
      },
      toJSON() {
        return { ...this };
      },
    };
    createdMessages.push(message);
    return message;
  };
  Conversation.findOrCreate = async () => [conversation, true];
  sequelize.query = async (sql) => {
    if (sql.includes('FROM wa_messages')) {
      return [
        {
          id: 'wa-message-1',
          user_id: 'user-1',
          wa_account_id: 'wa-1',
          contact_phone: '+918800281734',
          type: 'template',
          content: { name: 'just_testing' },
          meta_message_id: 'wamid-1',
          campaign_id: 'campaign-1',
          created_at: new Date('2026-04-01T06:30:00.000Z'),
        },
      ];
    }

    if (sql.includes('FROM contact_contacts')) {
      return [
        {
          name: 'Campaign Contact',
          whatsapp_name: null,
        },
      ];
    }

    return [];
  };

  await chatService.handleStatusUpdate(
    {
      metaMessageId: 'wamid-1',
      status: 'queued',
      contactPhone: '+918800281734',
      campaignId: 'campaign-1',
    },
    null
  );

  assert.equal(createdMessages.length, 1);
  assert.equal(createdMessages[0].direction, 'outbound');
  assert.equal(createdMessages[0].sender_type, 'system');
  assert.equal(createdMessages[0].status, 'pending');
  assert.equal(conversation.contact_name, 'Campaign Contact');
  assert.equal(conversation.last_message_preview, '[Template] just_testing');
});

test('handleStatusUpdate emits message status updates without reloading the whole conversation', async () => {
  const emittedEvents = [];
  const conversation = {
    id: 'conversation-2',
    user_id: 'org-1',
    contact_phone: '+918800281734',
    contact_name: 'Realtime Contact',
    last_message_at: new Date('2026-04-02T08:00:00.000Z'),
    last_message_preview: 'Latest preview',
    unread_count: 0,
    status: 'open',
    wa_account_id: 'wa-1',
    assigned_to: null,
    assigned_at: null,
    assigned_by: null,
    async reload() {
      return this;
    },
    toJSON() {
      return { ...this };
    },
  };
  const chatMessage = {
    id: 'chat-message-2',
    conversation_id: 'conversation-2',
    user_id: 'org-1',
    meta_message_id: 'wamid-2',
    status: 'pending',
    async update(values) {
      Object.assign(this, values);
      return this;
    },
  };
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emittedEvents.push({ room, event, payload });
        },
      };
    },
  };

  ChatMessage.findOne = async ({ where }) =>
    where.meta_message_id === 'wamid-2' ? chatMessage : null;
  await chatService.handleStatusUpdate(
    {
      metaMessageId: 'wamid-2',
      status: 'sent',
      contactPhone: '+918800281734',
    },
    io
  );

  assert.equal(chatMessage.status, 'sent');
  assert.deepEqual(
    emittedEvents.map(({ room, event }) => `${room}:${event}`),
    ['conversation:conversation-2:message:status']
  );
});

test('handleInboundMessage is idempotent for duplicate webhook deliveries', async () => {
  let createdCount = 0;
  const conversation = {
    id: 'conversation-1',
    user_id: 'org-1',
    async update() {
      return this;
    },
    async reload() {
      return this;
    },
  };
  const existingMessage = {
    id: 'chat-message-existing',
    conversation_id: 'conversation-1',
    user_id: 'org-1',
    meta_message_id: 'wamid-duplicate-1',
    status: 'delivered',
    toJSON() {
      return { ...this };
    },
  };

  Conversation.findOrCreate = async () => [conversation, false];
  ChatMessage.findOne = async ({ where }) =>
    where.meta_message_id === 'wamid-duplicate-1' ? existingMessage : null;
  ChatMessage.create = async () => {
    createdCount += 1;
    return null;
  };
  sequelize.query = async (sql) => {
    if (sql.includes('FROM wa_accounts')) {
      return [
        {
          id: 'wa-1',
          user_id: 'org-1',
          phone_number_id: '1030467583479012',
          status: 'active',
        },
      ];
    }

    return [];
  };

  const result = await chatService.handleInboundMessage(
    {
      phoneNumberId: '1030467583479012',
      message: {
        from: '+918800281734',
        id: 'wamid-duplicate-1',
        type: 'text',
        text: { body: 'hello again' },
      },
      contacts: [{ wa_id: '+918800281734', profile: { name: 'Smoke Contact' } }],
    },
    null
  );

  assert.equal(createdCount, 0);
  assert.equal(result.conversation.id, 'conversation-1');
  assert.equal(result.message.id, 'chat-message-existing');
});

test('handleInboundMessage recovers from a database uniqueness race by returning the stored message', async () => {
  const conversation = {
    id: 'conversation-1',
    user_id: 'org-1',
    async update() {
      return this;
    },
    async reload() {
      return this;
    },
  };
  const existingMessage = {
    id: 'chat-message-race',
    conversation_id: 'conversation-1',
    user_id: 'org-1',
    meta_message_id: 'wamid-race-1',
    status: 'delivered',
    toJSON() {
      return { ...this };
    },
  };

  let findOneCalls = 0;
  Conversation.findOrCreate = async () => [conversation, false];
  ChatMessage.findOne = async ({ where }) => {
    findOneCalls += 1;
    return where.meta_message_id === 'wamid-race-1' ? existingMessage : null;
  };
  ChatMessage.create = async () => {
    throw new UniqueConstraintError({ errors: [] });
  };
  sequelize.query = async (sql) => {
    if (sql.includes('FROM wa_accounts')) {
      return [
        {
          id: 'wa-1',
          user_id: 'org-1',
          phone_number_id: '1030467583479012',
          status: 'active',
        },
      ];
    }

    return [];
  };

  const result = await chatService.handleInboundMessage(
    {
      phoneNumberId: '1030467583479012',
      message: {
        from: '+918800281734',
        id: 'wamid-race-1',
        type: 'text',
        text: { body: 'race replay' },
      },
      contacts: [{ wa_id: '+918800281734', profile: { name: 'Smoke Contact' } }],
    },
    null
  );

  assert.ok(findOneCalls >= 1);
  assert.equal(result.message.id, 'chat-message-race');
});
