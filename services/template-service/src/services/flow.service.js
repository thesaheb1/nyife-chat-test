'use strict';

const { Op, QueryTypes } = require('sequelize');
const axios = require('axios');
const { Flow, FlowSubmission, sequelize } = require('../models');
const {
  AppError,
  getPagination,
  getPaginationMeta,
  resolveMetaAccessCredential,
} = require('@nyife/shared-utils');
const {
  FLOW_CATEGORIES,
  FLOW_CATEGORY_ALIASES,
  FLOW_STATUSES,
} = require('../constants/flow.constants');
const {
  createDefaultFlowDefinition,
  validateFlowDefinition,
} = require('../helpers/flowSchema');
const {
  normalizeFlowLifecycleStatus,
  getFlowAvailableActions,
  canEditFlow,
  canPublishFlow,
  canDeleteFlow,
  canDeprecateFlow,
} = require('../helpers/flowLifecycle');
const config = require('../config');
const { resolveSingleWabaAccount } = require('./waAccountContext.service');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asTrimmedString(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value).trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeCategories(categories) {
  const source = Array.isArray(categories) ? categories : [categories];
  const normalized = unique(
    source
      .map((category) => FLOW_CATEGORY_ALIASES[asTrimmedString(category)] || asTrimmedString(category))
      .filter((category) => FLOW_CATEGORIES.includes(category))
  );

  return normalized.length > 0 ? normalized : ['OTHER'];
}

function normalizeValidationState(name, categories, definitionInput) {
  const fallbackDefinition = createDefaultFlowDefinition(name, categories);
  const definition = definitionInput || fallbackDefinition;
  const validation = validateFlowDefinition(definition, { name, categories });

  return {
    definitionToStore: validation.normalized || definition,
    validationErrors: validation.validationErrors || [],
    validationErrorDetails: validation.validationErrorDetails || [],
    jsonVersion:
      validation.normalized?.version
      || definition.version
      || fallbackDefinition.version
      || '7.1',
  };
}

async function resolveFlowExecutionContext(userId, wabaId, providedAccessToken) {
  const selection = await resolveSingleWabaAccount(userId, {
    wabaId: wabaId || null,
    allowFallbackByWaba: Boolean(wabaId),
    allowAutoResolve: true,
  });
  const resolvedWabaId = selection.waba_id || (wabaId ? String(wabaId) : null);

  if (providedAccessToken) {
    return {
      accessToken: Array.isArray(providedAccessToken) ? providedAccessToken[0] : providedAccessToken,
      wabaId: resolvedWabaId,
      waAccountId: selection.wa_account_id || null,
    };
  }

  const credential = resolveMetaAccessCredential({
    systemUserAccessToken: config.meta.systemUserAccessToken,
    encryptedAccessToken: selection.account?.access_token || null,
    allowLegacyAccountTokenFallback: config.meta.allowLegacyAccountTokenFallback,
  });

  return {
    accessToken: credential?.accessToken || null,
    wabaId: resolvedWabaId,
    waAccountId: selection.wa_account_id || null,
  };
}

function normalizeFlowForResponse(flow) {
  if (!flow) {
    return flow;
  }

  const categories = normalizeCategories(flow.categories);
  const status = FLOW_STATUSES.includes(normalizeFlowLifecycleStatus(flow.status))
    ? normalizeFlowLifecycleStatus(flow.status)
    : 'DRAFT';
  const previewUrl = flow.preview_url && /^\/?flows\//.test(flow.preview_url)
    ? null
    : flow.preview_url;

  if (typeof flow.setDataValue === 'function') {
    flow.setDataValue('categories', categories);
    flow.setDataValue('status', status);
    flow.setDataValue('preview_url', previewUrl);
    flow.setDataValue('available_actions', getFlowAvailableActions(status));
    return flow;
  }

  return {
    ...flow,
    categories,
    status,
    preview_url: previewUrl,
    available_actions: getFlowAvailableActions(status),
  };
}

async function findFlow(userId, flowId) {
  const flow = await Flow.findOne({
    where: { id: flowId, user_id: userId },
  });

  if (!flow) {
    throw AppError.notFound('Flow not found');
  }

  return normalizeFlowForResponse(flow);
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

function hasUnsupportedDataExchange(dataExchangeConfig) {
  return isPlainObject(dataExchangeConfig) && Object.keys(dataExchangeConfig).length > 0;
}

function assertStaticFlowSupported(flow) {
  if (hasUnsupportedDataExchange(flow.data_exchange_config)) {
    throw AppError.badRequest(
      'Endpoint-powered data exchange flows are not supported for Meta publish in this phase. Clear the data exchange configuration or continue in JSON-only phase 2 work.'
    );
  }
}

function assertFlowCanSyncToMeta(flow, actionLabel = 'save this flow to Meta') {
  if (
    flow.status === 'DEPRECATED'
    || asTrimmedString(flow.meta_status).toUpperCase().includes('DEPREC')
  ) {
    throw AppError.badRequest(
      `This flow is deprecated on Meta and can no longer be updated. Duplicate the flow or create a new one before you ${actionLabel}.`
    );
  }
}

async function generateDuplicateFlowName(userId, sourceName, wabaId, mode = 'copy') {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = `${mode}_${Date.now()}${attempt > 0 ? `_${attempt}` : ''}`;
    const base = asTrimmedString(sourceName, 'flow').slice(0, 255 - suffix.length - 1);
    const candidate = `${base}_${suffix}`;
    const existing = await Flow.findOne({
      where: {
        user_id: userId,
        waba_id: wabaId || null,
        name: candidate,
      },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw AppError.conflict('Unable to create a unique duplicate flow name right now.');
}

function buildMetaFlowCreatePayload(flow, wabaId) {
  const payload = {
    name: flow.name,
    categories: normalizeCategories(flow.categories),
    waba_id: wabaId,
  };

  const jsonDefinition = flow.json_definition || {};
  if (jsonDefinition.data_api_version) {
    payload.data_api_version = jsonDefinition.data_api_version;
  }

  return payload;
}

function buildMetaMetadataForm(flow) {
  const form = new FormData();
  form.append('name', flow.name);
  form.append('categories', JSON.stringify(normalizeCategories(flow.categories)));

  const jsonDefinition = flow.json_definition || {};
  if (jsonDefinition.data_api_version) {
    form.append('data_api_version', String(jsonDefinition.data_api_version));
  }

  return form;
}

function buildFlowJsonForm(flow) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([JSON.stringify(flow.json_definition || {})], { type: 'application/json' }),
    'flow.json'
  );
  form.append('name', 'flow.json');
  form.append('asset_type', 'FLOW_JSON');
  return form;
}

function mapMetaLifecycleStatus(status) {
  return normalizeFlowLifecycleStatus(status);
}

function extractMetaValidationDetails(payload) {
  const raw = payload?.validation_errors;
  if (Array.isArray(raw)) {
    return raw.map((entry, index) => {
      if (isPlainObject(entry)) {
        return {
          code: entry.code || entry.error_code || `meta_validation_${index + 1}`,
          message:
            asTrimmedString(entry.message)
            || asTrimmedString(entry.error)
            || asTrimmedString(entry.description)
            || JSON.stringify(entry),
          line: entry.line ?? entry.line_number ?? null,
          column: entry.column ?? entry.column_number ?? null,
          path: entry.path || entry.field || entry.key || null,
          raw: entry,
        };
      }

      return {
        code: `meta_validation_${index + 1}`,
        message: asTrimmedString(entry, 'Unknown Meta validation error'),
      };
    });
  }

  if (isPlainObject(raw)) {
    return Object.entries(raw).map(([key, value], index) => ({
      code: `meta_validation_${index + 1}`,
      path: key,
      message: isPlainObject(value)
        ? asTrimmedString(value.message || value.error || JSON.stringify(value), `${key}: invalid`)
        : `${key}: ${asTrimmedString(value)}`,
      raw: value,
    }));
  }

  return [];
}

function extractMetaValidationErrors(payload) {
  return extractMetaValidationDetails(payload).map((entry) => {
    const line = entry.line ? ` (line ${entry.line}${entry.column ? `, column ${entry.column}` : ''})` : '';
    return `${entry.message}${line}`;
  });
}

function extractPreviewUrl(payload) {
  return (
    payload?.preview_url
    || payload?.preview?.preview_url
    || payload?.preview?.url
    || null
  );
}

function extractPreviewExpiresAt(payload) {
  const raw = payload?.preview_expires_at || payload?.preview?.expires_at || null;
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractHealthStatus(payload) {
  return isPlainObject(payload?.health_status) ? payload.health_status : null;
}

function extractCanSendMessage(payload) {
  const healthStatus = extractHealthStatus(payload);
  if (typeof payload?.can_send_message === 'boolean') {
    return payload.can_send_message;
  }
  if (typeof healthStatus?.can_send_message === 'boolean') {
    return healthStatus.can_send_message;
  }
  if (typeof healthStatus?.can_send_messages === 'boolean') {
    return healthStatus.can_send_messages;
  }
  return null;
}

function formatMetaError(prefix, err) {
  const metaError = err.response?.data?.error;
  return `${prefix}: ${metaError?.message || err.message}`;
}

function isAppError(err) {
  return Boolean(err) && (err.name === 'AppError' || typeof err.statusCode === 'number');
}

function summarizeValidationErrors(errors) {
  const items = unique((errors || []).map((entry) => asTrimmedString(entry)).filter(Boolean));
  if (items.length === 0) {
    return null;
  }

  return items.slice(0, 3).join(' | ');
}

function buildPublishFailureMessage(baseMessage, {
  validationErrors = [],
  remoteStatus = null,
  healthStatus = null,
} = {}) {
  const parts = [];
  const validationSummary = summarizeValidationErrors(validationErrors);
  if (validationSummary) {
    parts.push(`Validation errors: ${validationSummary}`);
  }

  if (remoteStatus) {
    parts.push(`Remote status: ${remoteStatus}`);
  }

  if (typeof healthStatus?.can_send_message === 'boolean' && healthStatus.can_send_message === false) {
    parts.push('Meta health status reports that this flow cannot send messages yet.');
  }

  if (parts.length === 0) {
    return baseMessage;
  }

  return `${baseMessage}. ${parts.join(' ')}`;
}

async function createRemoteFlow(flow, wabaId, accessToken) {
  const response = await axios.post(
    `${config.meta.baseUrl}/${wabaId}/flows`,
    buildMetaFlowCreatePayload(flow, wabaId),
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

async function updateRemoteFlowMetadata(metaFlowId, flow, accessToken) {
  const response = await axios.post(
    `${config.meta.baseUrl}/${metaFlowId}`,
    buildMetaMetadataForm(flow),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    }
  );

  return response.data || {};
}

async function uploadRemoteFlowJson(metaFlowId, flow, accessToken) {
  const response = await axios.post(
    `${config.meta.baseUrl}/${metaFlowId}/assets`,
    buildFlowJsonForm(flow),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 20000,
    }
  );

  return response.data || {};
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

  const payload = response.data || {};
  if (payload.success === false) {
    throw AppError.badRequest(
      buildPublishFailureMessage(
        asTrimmedString(payload.message || payload.error_message, 'Publishing attempt failed'),
        {
          validationErrors: extractMetaValidationErrors(payload),
          remoteStatus: asTrimmedString(payload.status) || null,
          healthStatus: extractHealthStatus(payload),
        }
      )
    );
  }

  return payload;
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

async function deleteRemoteFlow(metaFlowId, accessToken) {
  const response = await axios.delete(
    `${config.meta.baseUrl}/${metaFlowId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    }
  );

  return response.data || {};
}

async function listRemoteFlows(wabaId, accessToken) {
  const items = [];
  const initialUrl = new URL(`${config.meta.baseUrl}/${wabaId}/flows`);
  initialUrl.searchParams.set('fields', 'id,name,status,categories');
  initialUrl.searchParams.set('limit', '100');

  let nextUrl = initialUrl.toString();
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

async function getRemoteFlowDetails(metaFlowId, accessToken, { invalidatePreview = false } = {}) {
  const url = new URL(`${config.meta.baseUrl}/${metaFlowId}`);
  const previewField = `preview.invalidate(${invalidatePreview ? 'true' : 'false'})`;
  url.searchParams.set(
    'fields',
    `id,name,status,categories,validation_errors,health_status,${previewField}`
  );

  const response = await axios.get(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 15000,
  });

  return response.data || {};
}

async function listRemoteFlowAssets(metaFlowId, accessToken) {
  const assets = [];
  const initialUrl = new URL(`${config.meta.baseUrl}/${metaFlowId}/assets`);
  initialUrl.searchParams.set('fields', 'name,asset_type,download_url');
  initialUrl.searchParams.set('limit', '100');

  let nextUrl = initialUrl.toString();
  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    assets.push(...(Array.isArray(response.data?.data) ? response.data.data : []));
    nextUrl = response.data?.paging?.next || null;
  }

  return assets;
}

async function downloadRemoteFlowJson(downloadUrl, accessToken) {
  const response = await axios.get(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    responseType: 'text',
    transformResponse: [(value) => value],
    timeout: 15000,
  });

  if (typeof response.data === 'string') {
    try {
      return JSON.parse(response.data);
    } catch {
      return null;
    }
  }

  return isPlainObject(response.data) ? response.data : null;
}

async function getRemoteFlowBundle(metaFlowId, accessToken, { includeJson = false } = {}) {
  const details = await getRemoteFlowDetails(metaFlowId, accessToken);

  let flowJson = null;
  if (includeJson) {
    try {
      const assets = await listRemoteFlowAssets(metaFlowId, accessToken);
      const flowJsonAsset = assets.find((asset) => (
        asTrimmedString(asset.asset_type).toUpperCase() === 'FLOW_JSON'
        || asTrimmedString(asset.name).toLowerCase() === 'flow.json'
      ));

      if (flowJsonAsset?.download_url) {
        flowJson = await downloadRemoteFlowJson(flowJsonAsset.download_url, accessToken);
      }
    } catch {
      flowJson = null;
    }
  }

  return {
    ...details,
    flow_json: flowJson,
  };
}

function buildRemoteStatePatch(remoteFlow, overrides = {}) {
  const validationErrors = extractMetaValidationErrors(remoteFlow);
  const validationErrorDetails = extractMetaValidationDetails(remoteFlow);
  const rawStatus = asTrimmedString(remoteFlow.status) || null;

  return {
    ...overrides,
    preview_url: extractPreviewUrl(remoteFlow),
    preview_expires_at: extractPreviewExpiresAt(remoteFlow),
    status: FLOW_STATUSES.includes(mapMetaLifecycleStatus(rawStatus))
      ? mapMetaLifecycleStatus(rawStatus)
      : 'DRAFT',
    meta_status: rawStatus,
    meta_health_status: extractHealthStatus(remoteFlow),
    can_send_message: extractCanSendMessage(remoteFlow),
    validation_errors: validationErrors,
    validation_error_details: validationErrorDetails,
    has_local_changes: false,
    last_synced_at: new Date(),
  };
}

function buildSyncPayload(remoteFlow) {
  const remoteJson = remoteFlow.flow_json || remoteFlow.json_definition || null;
  const validation = remoteJson
    ? validateFlowDefinition(remoteJson, { name: remoteFlow.name || `Meta Flow ${remoteFlow.id}` })
    : null;

  return {
    name: remoteFlow.name || `Meta Flow ${remoteFlow.id}`,
    categories: normalizeCategories(remoteFlow.categories || ['OTHER']),
    status: FLOW_STATUSES.includes(mapMetaLifecycleStatus(remoteFlow.status))
      ? mapMetaLifecycleStatus(remoteFlow.status)
      : 'DRAFT',
    meta_status: asTrimmedString(remoteFlow.status) || null,
    json_version:
      remoteFlow.json_version
      || validation?.normalized?.version
      || '7.1',
    json_definition: validation?.normalized || remoteJson || createDefaultFlowDefinition(remoteFlow.name, remoteFlow.categories),
    preview_url: extractPreviewUrl(remoteFlow),
    preview_expires_at: extractPreviewExpiresAt(remoteFlow),
    validation_errors: extractMetaValidationErrors(remoteFlow),
    validation_error_details: extractMetaValidationDetails(remoteFlow),
    meta_health_status: extractHealthStatus(remoteFlow),
    can_send_message: extractCanSendMessage(remoteFlow),
    last_synced_at: new Date(),
    has_local_changes: false,
  };
}

function assertLifecycleActionAllowed(flow, predicate, actionMessage) {
  if (!predicate(flow)) {
    throw AppError.badRequest(actionMessage);
  }
}

async function createFlow(userId, data) {
  const selection = await resolveSingleWabaAccount(userId, {
    waAccountId: data.wa_account_id || null,
    wabaId: data.waba_id || null,
    allowFallbackByWaba: Boolean(data.waba_id),
    allowAutoResolve: !data.wa_account_id && !data.waba_id,
  });
  const resolvedWabaId = selection.waba_id || null;
  const resolvedWaAccountId = selection.wa_account_id || data.wa_account_id || null;

  await ensureUniqueFlowName(userId, data.name, resolvedWabaId);

  const normalizedCategories = normalizeCategories(data.categories);
  const validationState = normalizeValidationState(data.name, normalizedCategories, data.json_definition);

  const flow = await Flow.create({
    user_id: userId,
    waba_id: resolvedWabaId,
    wa_account_id: resolvedWaAccountId,
    name: data.name,
    categories: normalizedCategories,
    status: 'DRAFT',
    json_version: data.json_version || validationState.jsonVersion,
    json_definition: validationState.definitionToStore,
    editor_state: data.editor_state || null,
    data_exchange_config: data.data_exchange_config || null,
    preview_url: null,
    preview_expires_at: null,
    validation_errors: validationState.validationErrors,
    validation_error_details: validationState.validationErrorDetails,
    meta_status: null,
    meta_health_status: null,
    can_send_message: null,
    has_local_changes: true,
  });

  return normalizeFlowForResponse(flow);
}

async function listFlows(userId, filters) {
  const { page, limit, status, search, waba_id, category, date_from, date_to } = filters;
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
    const normalizedCategory = normalizeCategories([category])[0];
    where.categories = { [Op.like]: `%${normalizedCategory}%` };
  }
  if (date_from || date_to) {
    where.updated_at = {};
    if (date_from) {
      where.updated_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      const endDate = new Date(date_to);
      endDate.setDate(endDate.getDate() + 1);
      where.updated_at[Op.lt] = endDate;
    }
  }

  const { rows, count } = await Flow.findAndCountAll({
    where,
    order: [['updated_at', 'DESC']],
    limit: sanitizedLimit,
    offset,
  });

  rows.forEach((flow) => normalizeFlowForResponse(flow));

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
  assertLifecycleActionAllowed(
    flow,
    canEditFlow,
    'Only draft flows can be updated. Published, throttled, blocked, and deprecated flows must be cloned before editing.'
  );

  let nextWabaId = data.waba_id !== undefined ? (data.waba_id || null) : flow.waba_id;
  let nextWaAccountId =
    data.wa_account_id !== undefined ? data.wa_account_id || null : flow.wa_account_id;
  const nextName = data.name || flow.name;

  if (data.waba_id !== undefined || data.wa_account_id !== undefined) {
    const selection = await resolveSingleWabaAccount(userId, {
      waAccountId: data.wa_account_id || null,
      wabaId: data.waba_id || null,
      allowFallbackByWaba: Boolean(data.waba_id),
      allowAutoResolve: !data.wa_account_id && !data.waba_id,
    });

    nextWabaId = selection.waba_id || nextWabaId;
    nextWaAccountId = selection.wa_account_id || nextWaAccountId;
  } else if (!nextWabaId) {
    const selection = await resolveSingleWabaAccount(userId, {
      allowAutoResolve: true,
    });

    nextWabaId = selection.waba_id || null;
    nextWaAccountId = nextWaAccountId || selection.wa_account_id || null;
  }

  if (nextName !== flow.name || nextWabaId !== flow.waba_id) {
    await ensureUniqueFlowName(userId, nextName, nextWabaId, flowId);
  }

  const definitionInput = data.json_definition !== undefined
    ? data.json_definition
    : flow.json_definition;
  const nextCategories = data.categories ? normalizeCategories(data.categories) : normalizeCategories(flow.categories);
  const validationState = normalizeValidationState(nextName, nextCategories, definitionInput);

  await flow.update({
    name: nextName,
    waba_id: nextWabaId,
    wa_account_id: nextWaAccountId,
    categories: nextCategories,
    json_version: data.json_version || validationState.jsonVersion,
    json_definition: validationState.definitionToStore,
    editor_state: data.editor_state !== undefined ? data.editor_state || null : flow.editor_state,
    data_exchange_config:
      data.data_exchange_config !== undefined
        ? data.data_exchange_config || null
        : flow.data_exchange_config,
    validation_errors: validationState.validationErrors,
    validation_error_details: validationState.validationErrorDetails,
    has_local_changes: true,
  });

  return normalizeFlowForResponse(flow);
}

async function deleteFlow(userId, flowId, accessToken) {
  const flow = await findFlow(userId, flowId);
  assertLifecycleActionAllowed(
    flow,
    canDeleteFlow,
    'Only draft flows can be deleted. Published, throttled, blocked, and deprecated flows must be deprecated or cloned instead.'
  );

  if (flow.meta_flow_id) {
    const executionContext = await resolveFlowExecutionContext(userId, flow.waba_id, accessToken);
    const resolvedAccessToken = executionContext.accessToken;
    if (!resolvedAccessToken) {
      throw AppError.badRequest(
        'WhatsApp access token is required to delete a Meta-linked flow draft.'
      );
    }

    let remoteFlow = null;
    try {
      remoteFlow = await getRemoteFlowDetails(flow.meta_flow_id, resolvedAccessToken);
    } catch (err) {
      if (err.response?.status !== 404) {
        throw AppError.badRequest(formatMetaError('Failed to verify the Meta flow before delete', err));
      }
    }

    if (remoteFlow && !canDeleteFlow(mapMetaLifecycleStatus(remoteFlow.status || flow.meta_status || flow.status))) {
      throw AppError.badRequest(
        'Only Meta draft flows can be deleted. Published, throttled, blocked, and deprecated Meta-linked flows must be deprecated instead.'
      );
    }

    if (remoteFlow) {
      try {
        await deleteRemoteFlow(flow.meta_flow_id, resolvedAccessToken);
      } catch (err) {
        throw AppError.badRequest(formatMetaError('Failed to delete the draft on Meta', err));
      }
    }
  }

  await flow.destroy();
}

async function duplicateFlow(userId, flowId) {
  const flow = await findFlow(userId, flowId);
  const validationState = normalizeValidationState(flow.name, normalizeCategories(flow.categories), flow.json_definition);
  const duplicateName = await generateDuplicateFlowName(
    userId,
    flow.name,
    flow.waba_id,
    flow.status === 'PUBLISHED' ? 'draft' : 'copy'
  );

  const duplicate = await Flow.create({
    user_id: userId,
    waba_id: flow.waba_id,
    wa_account_id: flow.wa_account_id,
    meta_flow_id: null,
    cloned_from_flow_id: flow.id,
    cloned_from_meta_flow_id: flow.meta_flow_id,
    name: duplicateName,
    categories: normalizeCategories(flow.categories),
    status: 'DRAFT',
    json_version: validationState.jsonVersion,
    json_definition: validationState.definitionToStore,
    editor_state: flow.editor_state,
    data_exchange_config: flow.data_exchange_config,
    preview_url: null,
    preview_expires_at: null,
    validation_errors: validationState.validationErrors,
    validation_error_details: validationState.validationErrorDetails,
    meta_status: null,
    meta_health_status: null,
    can_send_message: null,
    has_local_changes: true,
  });

  return normalizeFlowForResponse(duplicate);
}

async function saveFlowToMeta(userId, flowId, accessToken, wabaIdOverride) {
  const flow = await findFlow(userId, flowId);
  assertLifecycleActionAllowed(
    flow,
    canEditFlow,
    'Only draft flows can be saved back to Meta from Nyife. Clone the flow if you need a new editable draft.'
  );
  assertFlowCanSyncToMeta(flow);
  assertStaticFlowSupported(flow);

  const validationState = normalizeValidationState(flow.name, normalizeCategories(flow.categories), flow.json_definition);
  await flow.update({
    json_version: validationState.jsonVersion,
    json_definition: validationState.definitionToStore,
    validation_errors: validationState.validationErrors,
    validation_error_details: validationState.validationErrorDetails,
  });

  if (Array.isArray(validationState.validationErrors) && validationState.validationErrors.length > 0) {
    throw AppError.badRequest(
      `Fix validation errors before saving this flow to Meta. ${validationState.validationErrors[0]}`
    );
  }

  const executionContext = await resolveFlowExecutionContext(
    userId,
    wabaIdOverride || flow.waba_id,
    accessToken
  );
  const wabaId = executionContext.wabaId;
  if (!wabaId) {
    throw AppError.badRequest('Connect an active WhatsApp number before saving a flow to Meta.');
  }

  const resolvedAccessToken = executionContext.accessToken;
  if (!resolvedAccessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for flows. Connect an active WhatsApp account for this WABA or provide x-wa-access-token.'
    );
  }

  let metaFlowId = flow.meta_flow_id;
  if (!metaFlowId) {
    try {
      const createResponse = await createRemoteFlow(flow, wabaId, resolvedAccessToken);
      metaFlowId = createResponse.id || createResponse.flow_id || null;
    } catch (err) {
      throw AppError.badRequest(formatMetaError('Failed to create flow on Meta', err));
    }
  } else {
    try {
      const remoteState = await getRemoteFlowDetails(metaFlowId, resolvedAccessToken);
      if (asTrimmedString(remoteState.status).toUpperCase().includes('DEPREC')) {
        throw AppError.badRequest(
          'This linked Meta flow is deprecated and can no longer be updated. Duplicate the flow or create a new one instead.'
        );
      }
      await updateRemoteFlowMetadata(metaFlowId, flow, resolvedAccessToken);
    } catch (err) {
      if (err instanceof Error && err.name === 'AppError') {
        throw err;
      }
      if (err.statusCode) {
        throw err;
      }
      throw AppError.badRequest(formatMetaError('Failed to update flow metadata on Meta', err));
    }
  }

  if (!metaFlowId) {
    throw AppError.badRequest('Meta did not return a flow ID.');
  }

  try {
    await uploadRemoteFlowJson(metaFlowId, flow, resolvedAccessToken);
  } catch (err) {
    throw AppError.badRequest(formatMetaError('Failed to upload flow JSON to Meta', err));
  }

  let remoteFlow = null;
  try {
    remoteFlow = await getRemoteFlowDetails(metaFlowId, resolvedAccessToken);
  } catch (err) {
    throw AppError.badRequest(formatMetaError('Flow JSON uploaded but refreshing Meta flow state failed', err));
  }

  await flow.update({
    meta_flow_id: metaFlowId,
    waba_id: wabaId,
    wa_account_id: flow.wa_account_id || executionContext.waAccountId || null,
    ...buildRemoteStatePatch(remoteFlow, {
      json_version: validationState.jsonVersion,
      json_definition: validationState.definitionToStore,
    }),
  });

  return normalizeFlowForResponse(flow);
}

async function refreshFlowPreview(userId, flowId, accessToken, {
  wabaIdOverride = null,
  force = false,
} = {}) {
  const flow = await findFlow(userId, flowId);

  if (!flow.meta_flow_id) {
    throw AppError.badRequest('Save this flow to Meta before requesting the official preview.');
  }

  const executionContext = await resolveFlowExecutionContext(
    userId,
    wabaIdOverride || flow.waba_id,
    accessToken
  );
  const resolvedAccessToken = executionContext.accessToken;

  if (!resolvedAccessToken) {
    throw AppError.badRequest('WhatsApp access token is required to refresh the official flow preview.');
  }

  const previewExpired = !flow.preview_expires_at || new Date(flow.preview_expires_at) <= new Date();

  let remoteFlow = null;
  try {
    remoteFlow = await getRemoteFlowDetails(flow.meta_flow_id, resolvedAccessToken, {
      invalidatePreview: Boolean(force || previewExpired || !flow.preview_url),
    });
  } catch (err) {
    throw AppError.badRequest(formatMetaError('Failed to refresh the official Meta preview', err));
  }

  await flow.update(buildRemoteStatePatch(remoteFlow, {
    has_local_changes: flow.has_local_changes,
  }));

  return normalizeFlowForResponse(flow);
}

async function publishFlow(userId, flowId, accessToken, wabaIdOverride) {
  const currentFlow = await findFlow(userId, flowId);
  assertLifecycleActionAllowed(
    currentFlow,
    canPublishFlow,
    'Only draft flows can be published. Published, throttled, blocked, and deprecated flows must be cloned or deprecated according to their current status.'
  );

  const flow = await saveFlowToMeta(userId, flowId, accessToken, wabaIdOverride);
  if (flow.status !== 'DRAFT') {
    throw AppError.badRequest(
      'Meta draft is not ready to publish because the linked flow is no longer in draft state after save.'
    );
  }

  if (Array.isArray(flow.validation_errors) && flow.validation_errors.length > 0) {
    throw AppError.badRequest(
      buildPublishFailureMessage(
        'Meta draft is not ready to publish',
        {
          validationErrors: flow.validation_errors,
          remoteStatus: flow.meta_status,
          healthStatus: flow.meta_health_status,
        }
      )
    );
  }

  const executionContext = await resolveFlowExecutionContext(userId, flow.waba_id, accessToken);
  const resolvedAccessToken = executionContext.accessToken;
  if (!resolvedAccessToken) {
    throw AppError.badRequest('WhatsApp access token is required to publish a flow.');
  }

  let publishResponse = null;
  try {
    publishResponse = await publishRemoteFlow(flow.meta_flow_id, resolvedAccessToken);
    const remoteFlow = await getRemoteFlowDetails(flow.meta_flow_id, resolvedAccessToken);
    await flow.update(buildRemoteStatePatch(remoteFlow));
  } catch (err) {
    let remoteFlow = null;
    try {
      remoteFlow = await getRemoteFlowDetails(flow.meta_flow_id, resolvedAccessToken);
      await flow.update(buildRemoteStatePatch(remoteFlow));
    } catch {
      remoteFlow = null;
    }

    const validationErrors = unique([
      ...(Array.isArray(flow.validation_errors) ? flow.validation_errors : []),
      ...extractMetaValidationErrors(publishResponse),
      ...extractMetaValidationErrors(remoteFlow),
    ]);

    if (validationErrors.length > 0) {
      throw AppError.badRequest(
        buildPublishFailureMessage(
          'Failed to publish flow on Meta',
          {
            validationErrors,
            remoteStatus: asTrimmedString(remoteFlow?.status || flow.meta_status) || null,
            healthStatus: extractHealthStatus(remoteFlow) || flow.meta_health_status,
          }
        )
      );
    }

    if (isAppError(err)) {
      throw err;
    }

    throw AppError.badRequest(
      buildPublishFailureMessage(
        formatMetaError('Failed to publish flow on Meta', err),
        {
          remoteStatus: asTrimmedString(remoteFlow?.status || flow.meta_status) || null,
          healthStatus: extractHealthStatus(remoteFlow) || flow.meta_health_status,
        }
      )
    );
  }

  return normalizeFlowForResponse(flow);
}

async function deprecateFlow(userId, flowId, accessToken) {
  const flow = await findFlow(userId, flowId);
  assertLifecycleActionAllowed(
    flow,
    canDeprecateFlow,
    'Only published, throttled, or blocked flows can be deprecated.'
  );

  if (!flow.meta_flow_id) {
    throw AppError.badRequest('This flow has not been saved to Meta yet.');
  }

  const executionContext = await resolveFlowExecutionContext(userId, flow.waba_id, accessToken);
  const resolvedAccessToken = executionContext.accessToken;
  if (!resolvedAccessToken) {
    throw AppError.badRequest('WhatsApp access token is required to deprecate a flow.');
  }

  try {
    await deprecateRemoteFlow(flow.meta_flow_id, resolvedAccessToken);
    const remoteFlow = await getRemoteFlowDetails(flow.meta_flow_id, resolvedAccessToken);
    await flow.update(buildRemoteStatePatch(remoteFlow));
  } catch (err) {
    throw AppError.badRequest(formatMetaError('Failed to deprecate flow on Meta', err));
  }

  return normalizeFlowForResponse(flow);
}

async function syncFlows(userId, wabaId, accessToken, force = false) {
  const executionContext = await resolveFlowExecutionContext(userId, wabaId, accessToken);
  const resolvedAccessToken = executionContext.accessToken;
  const resolvedWabaId = executionContext.wabaId;
  if (!resolvedAccessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for syncing flows. Connect an active WhatsApp account for this WABA or provide x-wa-access-token.'
    );
  }

  if (!resolvedWabaId) {
    throw AppError.badRequest('Connect an active WhatsApp number before syncing flows from Meta.');
  }

  let remoteFlows = [];
  try {
    remoteFlows = await listRemoteFlows(resolvedWabaId, resolvedAccessToken);
  } catch (err) {
    throw AppError.badRequest(formatMetaError('Failed to sync flows from Meta', err));
  }

  let created = 0;
  let updated = 0;
  const conflicts = [];

  for (const remoteFlowSummary of remoteFlows) {
    let remoteFlow = remoteFlowSummary;
    try {
      remoteFlow = await getRemoteFlowBundle(remoteFlowSummary.id, resolvedAccessToken, {
        includeJson: true,
      });
    } catch {
      remoteFlow = remoteFlowSummary;
    }

    const local = await Flow.findOne({
      where: {
        user_id: userId,
        [Op.or]: [
          { meta_flow_id: remoteFlow.id || null },
          {
            name: remoteFlow.name || '',
            waba_id: resolvedWabaId,
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
        waba_id: resolvedWabaId,
        wa_account_id: local.wa_account_id || executionContext.waAccountId || null,
      });
      updated += 1;
      continue;
    }

    await Flow.create({
      user_id: userId,
      waba_id: resolvedWabaId,
      wa_account_id: executionContext.waAccountId || null,
      meta_flow_id: remoteFlow.id || null,
      name: payload.name,
      categories: payload.categories,
      status: payload.status,
      json_version: payload.json_version,
      json_definition: payload.json_definition,
      editor_state: null,
      data_exchange_config: null,
      preview_url: payload.preview_url,
      preview_expires_at: payload.preview_expires_at,
      validation_errors: payload.validation_errors,
      validation_error_details: payload.validation_error_details,
      meta_status: payload.meta_status,
      meta_health_status: payload.meta_health_status,
      can_send_message: payload.can_send_message,
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
  refreshFlowPreview,
  deprecateFlow,
  syncFlows,
  listSubmissions,
  storeFlowSubmission,
  handleDataExchange,
};
