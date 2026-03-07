'use strict';

const { Op, QueryTypes } = require('sequelize');
const axios = require('axios');
const { Flow, FlowSubmission, sequelize } = require('../models');
const { AppError, decrypt, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const {
  FLOW_CATEGORIES,
  FLOW_STATUSES,
} = require('../constants/flow.constants');
const {
  createDefaultFlowDefinition,
  validateFlowDefinition,
} = require('../helpers/flowSchema');
const config = require('../config');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return ['OTHER'];
  }

  return [...new Set(categories.filter((category) => FLOW_CATEGORIES.includes(category)))];
}

function normalizeValidationState(name, definitionInput) {
  const fallbackDefinition = createDefaultFlowDefinition(name);
  const definition = definitionInput || fallbackDefinition;
  const validation = validateFlowDefinition(definition);

  return {
    definitionToStore: validation.normalized || definition,
    validationErrors: validation.validationErrors,
    jsonVersion:
      validation.normalized?.version
      || definition.version
      || fallbackDefinition.version
      || '7.1',
  };
}

async function resolveAccessToken(userId, wabaId, providedAccessToken) {
  if (providedAccessToken) {
    return Array.isArray(providedAccessToken) ? providedAccessToken[0] : providedAccessToken;
  }

  if (config.meta.systemUserAccessToken) {
    return config.meta.systemUserAccessToken;
  }

  if (!wabaId) {
    return null;
  }

  let accounts = [];
  try {
    accounts = await sequelize.query(
      `SELECT access_token
       FROM wa_accounts
       WHERE user_id = :userId
         AND waba_id = :wabaId
         AND status = :status
         AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      {
        replacements: {
          userId,
          wabaId: String(wabaId),
          status: 'active',
        },
        type: QueryTypes.SELECT,
      }
    );
  } catch (err) {
    console.warn('[template-service] Failed to load stored WhatsApp account token for flows:', err.message);
    return null;
  }

  if (!accounts || accounts.length === 0 || !accounts[0].access_token) {
    return null;
  }

  try {
    return decrypt(accounts[0].access_token);
  } catch (err) {
    console.warn('[template-service] Failed to decrypt stored flow access token:', err.message);
    return null;
  }
}

async function findFlow(userId, flowId) {
  const flow = await Flow.findOne({
    where: { id: flowId, user_id: userId },
  });

  if (!flow) {
    throw AppError.notFound('Flow not found');
  }

  return flow;
}

async function ensureUniqueFlowName(userId, name, wabaId, excludeId) {
  const where = {
    user_id: userId,
    name,
    waba_id: wabaId || null,
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existing = await Flow.findOne({ where });
  if (existing) {
    throw AppError.conflict(
      `A flow named "${name}" already exists${wabaId ? ` for WABA ${wabaId}` : ''}.`
    );
  }
}

function buildFlowPreviewUrl(flowId) {
  if (!config.frontendBaseUrl) {
    return null;
  }

  return `${config.frontendBaseUrl.replace(/\/$/, '')}/flows/${flowId}`;
}

function buildMetaFlowCreatePayload(flow, wabaId) {
  const payload = {
    name: flow.name,
    categories: flow.categories,
  };

  const jsonDefinition = flow.json_definition || {};
  if (jsonDefinition.data_api_version) {
    payload.data_api_version = jsonDefinition.data_api_version;
  }

  if (flow.data_exchange_config && Object.keys(flow.data_exchange_config).length > 0) {
    payload.endpoint_uri = `${config.publicApiBaseUrl.replace(/\/$/, '')}/api/v1/whatsapp/flows/data-exchange`;
  }

  payload.waba_id = wabaId;
  return payload;
}

function buildRemoteFlowJsonPayload(flow) {
  return {
    asset_type: 'FLOW_JSON',
    file_name: 'flow.json',
    flow_json: flow.json_definition,
    json_version: flow.json_version,
  };
}

async function createRemoteFlow(flow, wabaId, accessToken) {
  const payload = buildMetaFlowCreatePayload(flow, wabaId);
  const response = await axios.post(
    `${config.meta.baseUrl}/${wabaId}/flows`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data || {};
}

async function uploadRemoteFlowJson(metaFlowId, flow, accessToken) {
  const payload = buildRemoteFlowJsonPayload(flow);

  try {
    const response = await axios.post(
      `${config.meta.baseUrl}/${metaFlowId}/assets`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );
    return response.data || {};
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 400) {
      const fallback = await axios.post(
        `${config.meta.baseUrl}/${metaFlowId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );
      return fallback.data || {};
    }

    throw err;
  }
}

async function publishRemoteFlow(metaFlowId, accessToken) {
  const response = await axios.post(
    `${config.meta.baseUrl}/${metaFlowId}/publish`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data || {};
}

async function deprecateRemoteFlow(metaFlowId, accessToken) {
  const response = await axios.post(
    `${config.meta.baseUrl}/${metaFlowId}/deprecate`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return response.data || {};
}

async function listRemoteFlows(wabaId, accessToken) {
  const items = [];
  let nextUrl = `${config.meta.baseUrl}/${wabaId}/flows?limit=100`;

  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    const pageData = Array.isArray(response.data?.data) ? response.data.data : [];
    items.push(...pageData);
    nextUrl = response.data?.paging?.next || null;
  }

  return items;
}

function mapMetaStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized.includes('PUBLISH')) {
    return 'PUBLISHED';
  }
  if (normalized.includes('DEPREC')) {
    return 'DEPRECATED';
  }
  return 'DRAFT';
}

function extractMetaValidationErrors(payload) {
  const errors = payload?.validation_errors;
  if (Array.isArray(errors)) {
    return errors.map((entry) => String(entry.message || entry.error || entry));
  }

  if (errors && typeof errors === 'object') {
    return Object.entries(errors).map(([key, value]) => `${key}: ${String(value)}`);
  }

  return [];
}

function buildSyncPayload(remoteFlow) {
  const remoteJson = remoteFlow.flow_json || remoteFlow.json_definition || null;
  const validation = remoteJson ? validateFlowDefinition(remoteJson) : null;

  return {
    name: remoteFlow.name || `Meta Flow ${remoteFlow.id}`,
    categories: normalizeCategories(remoteFlow.categories || ['OTHER']),
    status: FLOW_STATUSES.includes(mapMetaStatus(remoteFlow.status))
      ? mapMetaStatus(remoteFlow.status)
      : 'DRAFT',
    json_version:
      remoteFlow.json_version
      || validation?.normalized?.version
      || '7.1',
    json_definition: validation?.normalized || remoteJson || createDefaultFlowDefinition(remoteFlow.name),
    preview_url: remoteFlow.preview_url || remoteFlow.preview?.preview_url || null,
    validation_errors: validation?.validationErrors || extractMetaValidationErrors(remoteFlow),
    last_synced_at: new Date(),
    has_local_changes: false,
  };
}

async function createFlow(userId, data) {
  await ensureUniqueFlowName(userId, data.name, data.waba_id || null);

  const validationState = normalizeValidationState(data.name, data.json_definition);

  const flow = await Flow.create({
    user_id: userId,
    waba_id: data.waba_id || null,
    wa_account_id: data.wa_account_id || null,
    name: data.name,
    categories: normalizeCategories(data.categories),
    status: 'DRAFT',
    json_version: data.json_version || validationState.jsonVersion,
    json_definition: validationState.definitionToStore,
    editor_state: data.editor_state || null,
    data_exchange_config: data.data_exchange_config || null,
    preview_url: null,
    validation_errors: validationState.validationErrors,
    has_local_changes: true,
  });

  await flow.update({
    preview_url: buildFlowPreviewUrl(flow.id),
  });

  return flow;
}

async function listFlows(userId, filters) {
  const { page, limit, status, search, waba_id, category } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const where = { user_id: userId };
  if (status) {
    where.status = status;
  }
  if (waba_id) {
    where.waba_id = waba_id;
  }
  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }
  if (category) {
    where.categories = { [Op.like]: `%${category}%` };
  }

  const { rows, count } = await Flow.findAndCountAll({
    where,
    order: [['updated_at', 'DESC']],
    limit: sanitizedLimit,
    offset,
  });

  return {
    flows: rows,
    meta: getPaginationMeta(count, page, sanitizedLimit),
  };
}

async function getFlow(userId, flowId) {
  return findFlow(userId, flowId);
}

async function updateFlow(userId, flowId, data) {
  const flow = await findFlow(userId, flowId);
  const nextWabaId = data.waba_id !== undefined ? (data.waba_id || null) : flow.waba_id;
  const nextName = data.name || flow.name;

  if (nextName !== flow.name || nextWabaId !== flow.waba_id) {
    await ensureUniqueFlowName(userId, nextName, nextWabaId, flowId);
  }

  const definitionInput = data.json_definition !== undefined
    ? data.json_definition
    : flow.json_definition;
  const validationState = normalizeValidationState(nextName, definitionInput);

  await flow.update({
    name: nextName,
    waba_id: nextWabaId,
    wa_account_id: data.wa_account_id !== undefined ? data.wa_account_id || null : flow.wa_account_id,
    categories: data.categories ? normalizeCategories(data.categories) : flow.categories,
    json_version: data.json_version || validationState.jsonVersion,
    json_definition: validationState.definitionToStore,
    editor_state: data.editor_state !== undefined ? data.editor_state || null : flow.editor_state,
    data_exchange_config:
      data.data_exchange_config !== undefined
        ? data.data_exchange_config || null
        : flow.data_exchange_config,
    validation_errors: validationState.validationErrors,
    has_local_changes: true,
  });

  return flow;
}

async function deleteFlow(userId, flowId) {
  const flow = await findFlow(userId, flowId);
  await flow.destroy();
}

async function duplicateFlow(userId, flowId) {
  const flow = await findFlow(userId, flowId);
  const duplicateName = `${flow.name}_copy_${Date.now()}`;

  const duplicate = await Flow.create({
    user_id: userId,
    waba_id: flow.waba_id,
    wa_account_id: flow.wa_account_id,
    name: duplicateName,
    categories: flow.categories,
    status: 'DRAFT',
    json_version: flow.json_version,
    json_definition: flow.json_definition,
    editor_state: flow.editor_state,
    data_exchange_config: flow.data_exchange_config,
    preview_url: null,
    validation_errors: flow.validation_errors || [],
    has_local_changes: true,
  });

  await duplicate.update({
    preview_url: buildFlowPreviewUrl(duplicate.id),
  });

  return duplicate;
}

async function saveFlowToMeta(userId, flowId, accessToken, wabaIdOverride) {
  const flow = await findFlow(userId, flowId);

  if (Array.isArray(flow.validation_errors) && flow.validation_errors.length > 0) {
    throw AppError.badRequest(
      `Fix validation errors before saving this flow to Meta. ${flow.validation_errors[0]}`
    );
  }

  const wabaId = wabaIdOverride || flow.waba_id;
  if (!wabaId) {
    throw AppError.badRequest('WABA ID is required to save a flow to Meta.');
  }

  const resolvedAccessToken = await resolveAccessToken(userId, wabaId, accessToken);
  if (!resolvedAccessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for flows. Connect an active WhatsApp account for this WABA or provide x-wa-access-token.'
    );
  }

  let metaFlowId = flow.meta_flow_id;
  let createResponse = {};
  if (!metaFlowId) {
    try {
      createResponse = await createRemoteFlow(flow, wabaId, resolvedAccessToken);
      metaFlowId = createResponse.id || createResponse.flow_id || null;
    } catch (err) {
      const metaError = err.response?.data?.error;
      throw AppError.badRequest(
        `Failed to create flow on Meta: ${metaError?.message || err.message}`
      );
    }
  }

  if (!metaFlowId) {
    throw AppError.badRequest('Meta did not return a flow ID.');
  }

  let uploadResponse = {};
  try {
    uploadResponse = await uploadRemoteFlowJson(metaFlowId, flow, resolvedAccessToken);
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw AppError.badRequest(
      `Failed to upload flow JSON to Meta: ${metaError?.message || err.message}`
    );
  }

  await flow.update({
    meta_flow_id: metaFlowId,
    waba_id: wabaId,
    preview_url:
      uploadResponse.preview_url
      || createResponse.preview_url
      || createResponse.preview?.preview_url
      || flow.preview_url,
    validation_errors: extractMetaValidationErrors(uploadResponse),
    has_local_changes: false,
    last_synced_at: new Date(),
  });

  return flow;
}

async function publishFlow(userId, flowId, accessToken, wabaIdOverride) {
  const flow = await saveFlowToMeta(userId, flowId, accessToken, wabaIdOverride);
  const resolvedAccessToken = await resolveAccessToken(userId, flow.waba_id, accessToken);

  if (!resolvedAccessToken) {
    throw AppError.badRequest('WhatsApp access token is required to publish a flow.');
  }

  try {
    const response = await publishRemoteFlow(flow.meta_flow_id, resolvedAccessToken);
    await flow.update({
      status: mapMetaStatus(response.status || 'PUBLISHED'),
      preview_url: response.preview_url || response.preview?.preview_url || flow.preview_url,
      validation_errors: extractMetaValidationErrors(response),
      has_local_changes: false,
      last_synced_at: new Date(),
    });
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw AppError.badRequest(
      `Failed to publish flow on Meta: ${metaError?.message || err.message}`
    );
  }

  return flow;
}

async function deprecateFlow(userId, flowId, accessToken) {
  const flow = await findFlow(userId, flowId);

  if (!flow.meta_flow_id) {
    throw AppError.badRequest('This flow has not been saved to Meta yet.');
  }

  const resolvedAccessToken = await resolveAccessToken(userId, flow.waba_id, accessToken);
  if (!resolvedAccessToken) {
    throw AppError.badRequest('WhatsApp access token is required to deprecate a flow.');
  }

  try {
    const response = await deprecateRemoteFlow(flow.meta_flow_id, resolvedAccessToken);
    await flow.update({
      status: mapMetaStatus(response.status || 'DEPRECATED'),
      has_local_changes: false,
      last_synced_at: new Date(),
    });
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw AppError.badRequest(
      `Failed to deprecate flow on Meta: ${metaError?.message || err.message}`
    );
  }

  return flow;
}

async function syncFlows(userId, wabaId, accessToken, force = false) {
  const resolvedAccessToken = await resolveAccessToken(userId, wabaId, accessToken);
  if (!resolvedAccessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for syncing flows. Connect an active WhatsApp account for this WABA or provide x-wa-access-token.'
    );
  }

  let remoteFlows = [];
  try {
    remoteFlows = await listRemoteFlows(wabaId, resolvedAccessToken);
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw AppError.badRequest(
      `Failed to sync flows from Meta: ${metaError?.message || err.message}`
    );
  }

  let created = 0;
  let updated = 0;
  const conflicts = [];

  for (const remoteFlow of remoteFlows) {
    const local = await Flow.findOne({
      where: {
        user_id: userId,
        [Op.or]: [
          { meta_flow_id: remoteFlow.id || null },
          {
            name: remoteFlow.name || '',
            waba_id: wabaId,
          },
        ],
      },
    });

    const payload = buildSyncPayload(remoteFlow);

    if (local) {
      if (local.has_local_changes && !force) {
        conflicts.push({
          flow_id: local.id,
          name: local.name,
          meta_flow_id: local.meta_flow_id,
        });
        continue;
      }

      await local.update({
        ...payload,
        meta_flow_id: remoteFlow.id || local.meta_flow_id,
        waba_id: wabaId,
      });
      updated += 1;
      continue;
    }

    await Flow.create({
      user_id: userId,
      waba_id: wabaId,
      wa_account_id: null,
      meta_flow_id: remoteFlow.id || null,
      name: payload.name,
      categories: payload.categories,
      status: payload.status,
      json_version: payload.json_version,
      json_definition: payload.json_definition,
      editor_state: null,
      data_exchange_config: null,
      preview_url: payload.preview_url,
      validation_errors: payload.validation_errors,
      has_local_changes: false,
      last_synced_at: payload.last_synced_at,
    });
    created += 1;
  }

  return {
    synced: remoteFlows.length,
    created,
    updated,
    conflicts,
  };
}

async function listSubmissions(userId, flowId, filters) {
  await findFlow(userId, flowId);
  const { page, limit, screen_id, contact_phone, search } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const where = {
    user_id: userId,
    flow_id: flowId,
  };
  if (screen_id) {
    where.screen_id = screen_id;
  }
  if (contact_phone) {
    where.contact_phone = contact_phone;
  }
  if (search) {
    where.contact_phone = { [Op.like]: `%${search}%` };
  }

  const { rows, count } = await FlowSubmission.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: sanitizedLimit,
    offset,
  });

  return {
    submissions: rows,
    meta: getPaginationMeta(count, page, sanitizedLimit),
  };
}

async function getSubmission(userId, submissionId) {
  const submission = await FlowSubmission.findOne({
    where: {
      id: submissionId,
      user_id: userId,
    },
    include: [
      {
        model: Flow,
        as: 'flow',
      },
    ],
  });

  if (!submission) {
    throw AppError.notFound('Flow submission not found');
  }

  return submission;
}

async function resolveContactId(userId, contactPhone) {
  const contacts = await sequelize.query(
    `SELECT id
     FROM contact_contacts
     WHERE user_id = :userId
       AND phone = :contactPhone
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: { userId, contactPhone },
      type: QueryTypes.SELECT,
    }
  );

  return contacts[0]?.id || null;
}

async function storeFlowSubmission(event) {
  const metaFlowId = event.metaFlowId || event.meta_flow_id;
  if (!metaFlowId) {
    return null;
  }

  const flow = await Flow.findOne({
    where: {
      user_id: event.userId,
      meta_flow_id: metaFlowId,
    },
  });

  if (!flow) {
    return null;
  }

  const contactPhone = event.contactPhone || event.contact_phone;
  const contactId = contactPhone ? await resolveContactId(event.userId, contactPhone) : null;

  const submission = await FlowSubmission.create({
    user_id: event.userId,
    flow_id: flow.id,
    meta_flow_id: metaFlowId,
    contact_phone: contactPhone,
    contact_id: contactId,
    wa_account_id: event.waAccountId || event.wa_account_id,
    flow_token: event.flowToken || event.flow_token || null,
    screen_id: event.screenId || event.screen_id || null,
    submission_data: event.payload || event.submission_data || {},
    raw_payload: event.rawMessage || event.raw_payload || null,
    automation_status: 'stored',
  });

  return submission;
}

function getByPath(source, path) {
  if (!path) {
    return source;
  }

  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((current, segment) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[segment];
    }, source);
}

async function findFlowForDataExchange(userId, payload) {
  const where = {};
  if (payload.flow_id) {
    where.id = payload.flow_id;
  } else if (payload.meta_flow_id) {
    where.meta_flow_id = payload.meta_flow_id;
  }

  if (userId) {
    where.user_id = userId;
  }

  const flow = await Flow.findOne({ where });
  if (!flow) {
    throw AppError.notFound('Flow not found for data exchange.');
  }

  return flow;
}

async function handleDataExchange(userId, payload) {
  const flow = await findFlowForDataExchange(userId, payload);
  const configRoot = flow.data_exchange_config || {};
  const screenId = payload.screen_id || payload.screen || payload.payload?.screen || null;
  const screenConfig = screenId ? configRoot[screenId] || configRoot.screens?.[screenId] : null;

  if (!screenConfig) {
    return {
      flow_id: flow.id,
      meta_flow_id: flow.meta_flow_id,
      screen_id: screenId,
      data: payload.data || payload.payload || {},
    };
  }

  if (screenConfig.source_type === 'static') {
    return {
      flow_id: flow.id,
      meta_flow_id: flow.meta_flow_id,
      screen_id: screenId,
      data: screenConfig.response || screenConfig.static_response || screenConfig.options || {},
    };
  }

  if (screenConfig.source_type === 'http' && screenConfig.url) {
    const requestPayload = {
      flow_id: flow.id,
      meta_flow_id: flow.meta_flow_id,
      screen_id: screenId,
      flow_token: payload.flow_token,
      payload: payload.payload || {},
      data: payload.data || {},
    };

    const response = await axios({
      method: screenConfig.method || 'POST',
      url: screenConfig.url,
      data: requestPayload,
      headers: {
        'Content-Type': 'application/json',
        ...(screenConfig.headers || {}),
      },
      timeout: 10000,
    });

    const mappedData = screenConfig.response_path
      ? getByPath(response.data, screenConfig.response_path)
      : response.data;

    return {
      flow_id: flow.id,
      meta_flow_id: flow.meta_flow_id,
      screen_id: screenId,
      data: mappedData,
    };
  }

  return {
    flow_id: flow.id,
    meta_flow_id: flow.meta_flow_id,
    screen_id: screenId,
    data: payload.data || payload.payload || {},
  };
}

module.exports = {
  createFlow,
  listFlows,
  getFlow,
  updateFlow,
  deleteFlow,
  duplicateFlow,
  saveFlowToMeta,
  publishFlow,
  deprecateFlow,
  syncFlows,
  listSubmissions,
  getSubmission,
  storeFlowSubmission,
  handleDataExchange,
};
