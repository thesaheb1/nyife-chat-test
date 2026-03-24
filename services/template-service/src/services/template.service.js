'use strict';

const { Op } = require('sequelize');
const axios = require('axios');
const { Template, Flow } = require('../models');
const {
  AppError,
  getPagination,
  getPaginationMeta,
  resolveMetaAccessCredential,
} = require('@nyife/shared-utils');
const config = require('../config');
const {
  assertTemplateBusinessRules,
  getTemplateAvailableActions,
  normalizeMetaTemplateStatus,
  normalizeTemplateQualityScore,
  resolveTemplateMetaStatus,
  deriveLocalTemplateStatus,
  canPublishTemplate,
  canEditTemplate,
  canDeleteTemplate,
} = require('../helpers/templateRules');
const {
  fetchActiveWaAccountById,
  resolveSingleWabaAccount,
} = require('./waAccountContext.service');
const TEMPLATE_MEDIA_RULES = {
  IMAGE: {
    label: 'Image',
    mimeTypes: ['image/jpeg', 'image/png'],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  VIDEO: {
    label: 'Video',
    mimeTypes: ['video/mp4', 'video/3gpp', 'video/3gp'],
    maxSizeBytes: 16 * 1024 * 1024,
  },
  DOCUMENT: {
    label: 'Document',
    mimeTypes: [
      'text/plain',
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    maxSizeBytes: 100 * 1024 * 1024,
  },
};
const META_TEMPLATE_FIELDS = [
  'id',
  'name',
  'language',
  'status',
  'category',
  'components',
  'quality_score',
  'rejected_reason',
].join(',');

// ─── Helper: check subscription limit ──────────────────────────────────────

/**
 * Checks if the user has reached their template creation limit
 * by calling the subscription-service.
 *
 * @param {string} userId - The user's UUID
 * @returns {Promise<void>} Resolves if under limit, throws if exceeded
 */
async function checkSubscriptionLimit(userId) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/check-limit/${userId}/templates`,
      {
        timeout: 5000,
      }
    );

    if (response.data && response.data.success) {
      const limits = response.data.data;
      if (limits && limits.allowed === false) {
        if (limits.message === 'No active subscription') {
          throw AppError.forbidden(
            'No active subscription found. Please subscribe to a plan before creating templates.'
          );
        }

        const limitLabel = limits.limit === 'unlimited' ? 'your plan limit' : limits.limit;
        throw AppError.forbidden(
          `Template limit reached. Your plan allows a maximum of ${limitLabel} templates. Please upgrade your plan.`
        );
      }

      return;
    }

    throw AppError.internal('Invalid response received while validating your template subscription limit.');
  } catch (err) {
    // If the error is an AppError we threw, re-throw it
    if (err instanceof AppError) {
      throw err;
    }
    throw AppError.internal(
      'Unable to validate your template subscription limit right now. Please try again in a moment.'
    );
  }
}

// ─── Helper: notify subscription service of usage change ───────────────────

/**
 * Notifies the subscription service that a template was created or deleted.
 * Best-effort, does not block on failure.
 *
 * @param {string} userId
 * @param {'increment'|'decrement'} action
 */
async function notifySubscriptionUsage(userId, action) {
  try {
    await axios.post(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${userId}`,
      {
        resource: 'templates',
        count: action === 'increment' ? 1 : -1,
      },
      {
        timeout: 5000,
      }
    );
  } catch (err) {
    console.warn('[template-service] Could not update subscription usage:', err.message);
  }
}

function didTemplateConsumeQuota(template) {
  const record = typeof template?.toJSON === 'function' ? template.toJSON() : template;

  if (!record) {
    return false;
  }

  if (record.source === 'meta_sync') {
    return false;
  }

  return true;
}

async function resolveAccountContext(userId, options = {}) {
  const {
    waAccountId = null,
    wabaId = null,
    providedAccessToken = null,
    allowFallbackByWaba = true,
  } = options;

  const selection = await resolveSingleWabaAccount(userId, {
    waAccountId,
    wabaId,
    allowFallbackByWaba,
    allowAutoResolve: !waAccountId && !wabaId,
  });
  const account = selection.account || null;
  const resolvedWabaId = selection.waba_id || (wabaId ? String(wabaId) : null);

  if (providedAccessToken && resolvedWabaId) {
    return {
      wa_account_id: account?.id || waAccountId || null,
      waba_id: resolvedWabaId,
      access_token: Array.isArray(providedAccessToken)
        ? providedAccessToken[0]
        : providedAccessToken,
      account,
    };
  }

  const credential = resolveMetaAccessCredential({
    systemUserAccessToken: config.meta.systemUserAccessToken,
    encryptedAccessToken: account?.access_token || null,
    allowLegacyAccountTokenFallback: config.meta.allowLegacyAccountTokenFallback,
  });

  if (credential && resolvedWabaId) {
    return {
      wa_account_id: account?.id || waAccountId || null,
      waba_id: resolvedWabaId,
      access_token: credential.accessToken,
      account,
    };
  }

  return null;
}

function extractQualityScore(data) {
  return normalizeTemplateQualityScore(
    data?.quality_score?.score
      || data?.quality_score
      || data?.newQualityScore
      || data?.new_quality_score
  );
}

function extractQualityReasons(data) {
  const reasons = data?.quality_score?.reasons || data?.quality_reasons || [];
  if (!Array.isArray(reasons)) {
    return null;
  }

  const normalized = reasons
    .map((reason) => trimString(reason))
    .filter(Boolean);

  return normalized.length ? normalized : null;
}

function extractRejectionReason(data) {
  const value = trimString(
    data?.rejected_reason
      || data?.rejection_reason
      || data?.reason
  );
  return value || null;
}

function mapMetaTemplateToLocalState(metaTemplate, context = {}) {
  const metaStatusRaw = normalizeMetaTemplateStatus(metaTemplate?.status || metaTemplate?.meta_status_raw);
  const qualityScore = extractQualityScore(metaTemplate);
  const qualityReasons = extractQualityReasons(metaTemplate);
  const rejectionReason = extractRejectionReason(metaTemplate);

  return {
    name: metaTemplate?.name,
    language: metaTemplate?.language,
    category: metaTemplate?.category,
    type: detectTemplateType(metaTemplate?.components || []),
    status: deriveLocalTemplateStatus(metaStatusRaw, 'pending'),
    components: metaTemplate?.components || [],
    meta_template_id: metaTemplate?.id || context.metaTemplateId || null,
    meta_status_raw: metaStatusRaw,
    quality_score: qualityScore,
    quality_reasons: qualityReasons,
    rejection_reason: metaStatusRaw === 'REJECTED' ? rejectionReason : null,
    waba_id: context.wabaId !== undefined ? context.wabaId : undefined,
    wa_account_id: context.waAccountId !== undefined ? context.waAccountId : undefined,
    last_synced_at: new Date(),
  };
}

async function fetchMetaTemplateById(metaTemplateId, accessToken) {
  const response = await axios.get(
    `${config.meta.baseUrl}/${metaTemplateId}`,
    {
      params: {
        fields: META_TEMPLATE_FIELDS,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    }
  );

  return response.data;
}

async function findTemplateByMetaIdentifiers({ metaTemplateId, templateName, wabaId }) {
  const where = metaTemplateId
    ? { meta_template_id: metaTemplateId }
    : {
        waba_id: String(wabaId),
        name: templateName,
      };

  return Template.findOne({ where });
}

async function applyTemplateQualityEvent(event) {
  const metaTemplateId = event.messageTemplateId || event.message_template_id || null;
  const templateName = event.messageTemplateName || event.message_template_name || null;
  const wabaId = event.wabaId || event.waba_id || null;
  const qualityScore = extractQualityScore(event);

  if (!qualityScore) {
    throw AppError.badRequest('Template quality event is missing the new quality score.');
  }

  if (!metaTemplateId && (!templateName || !wabaId)) {
    throw AppError.badRequest('Template quality event is missing required identifiers.');
  }

  const template = await findTemplateByMetaIdentifiers({
    metaTemplateId,
    templateName,
    wabaId,
  });

  if (!template) {
    return null;
  }

  await template.update({
    quality_score: qualityScore,
    last_synced_at: new Date(),
  });

  return template;
}

async function applyTemplateStatusEvent(event) {
  if (
    event?.eventType === 'quality_update'
    || event?.newQualityScore
    || event?.new_quality_score
  ) {
    return applyTemplateQualityEvent(event);
  }

  const metaTemplateId = event.messageTemplateId || event.message_template_id || null;
  const templateName = event.messageTemplateName || event.message_template_name || null;
  const wabaId = event.wabaId || event.waba_id || null;
  const normalizedStatus = normalizeMetaTemplateStatus(event.status || event.event);

  if ((!metaTemplateId && (!templateName || !wabaId)) || !normalizedStatus) {
    throw AppError.badRequest('Template status event is missing required identifiers.');
  }

  const template = await findTemplateByMetaIdentifiers({
    metaTemplateId,
    templateName,
    wabaId,
  });
  if (!template) {
    return null;
  }

  await template.update({
    status: deriveLocalTemplateStatus(normalizedStatus, template.status),
    meta_status_raw: normalizedStatus,
    rejection_reason: normalizedStatus === 'REJECTED' ? extractRejectionReason(event) : null,
    meta_template_id: metaTemplateId || template.meta_template_id,
    last_synced_at: new Date(),
  });

  return template;
}

async function requireActiveWaAccount(userId, waAccountId) {
  const account = await fetchActiveWaAccountById(userId, waAccountId);
  if (!account) {
    throw AppError.badRequest('Select an active WhatsApp account before continuing.');
  }
  return account;
}

async function requireAutoResolvedWaAccount(userId, waAccountId, actionLabel) {
  if (waAccountId) {
    return requireActiveWaAccount(userId, waAccountId);
  }

  const selection = await resolveSingleWabaAccount(userId, {
    allowAutoResolve: true,
  });

  if (!selection.account) {
    throw AppError.badRequest(`Connect an active WhatsApp number before ${actionLabel}.`);
  }

  return selection.account;
}

function normalizeComponentType(type) {
  return String(type || '').toUpperCase();
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickDefinedEntries(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function assertMediaRecordCompatible(format, mediaRecord) {
  const rule = TEMPLATE_MEDIA_RULES[normalizeComponentType(format)];
  if (!rule) {
    return;
  }

  const mimeType = trimString(mediaRecord?.mime_type);
  if (!rule.mimeTypes.includes(mimeType)) {
    throw AppError.badRequest(
      `${rule.label} headers support ${rule.mimeTypes.join(', ')} only.`
    );
  }

  if (typeof mediaRecord?.size === 'number' && mediaRecord.size > rule.maxSizeBytes) {
    throw AppError.badRequest(
      `${rule.label} headers must be ${Math.round(rule.maxSizeBytes / (1024 * 1024))} MB or smaller.`
    );
  }
}

function normalizeButtonExample(example) {
  if (Array.isArray(example)) {
    const items = example.map((value) => trimString(value)).filter(Boolean);
    return items.length ? items : undefined;
  }

  const value = trimString(example);
  return value ? [value] : undefined;
}

async function fetchMediaRecord(userId, fileId) {
  try {
    const response = await axios.get(
      `${config.mediaServiceUrl}/api/v1/media/${fileId}`,
      {
        headers: {
          'x-user-id': userId,
        },
        timeout: 10000,
      }
    );

    return response.data?.data || null;
  } catch (err) {
    throw AppError.badRequest(
      `Unable to load the selected header sample from Nyife media storage. ${err.response?.data?.message || err.message}`
    );
  }
}

async function fetchMediaBinary(userId, fileId) {
  try {
    const response = await axios.get(
      `${config.mediaServiceUrl}/api/v1/media/${fileId}/download`,
      {
        headers: {
          'x-user-id': userId,
        },
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    return Buffer.from(response.data);
  } catch (err) {
    throw AppError.badRequest(
      `Unable to download the selected header sample from Nyife media storage. ${err.response?.data?.message || err.message}`
    );
  }
}

async function createMetaUploadSession(accessToken, mediaRecord) {
  if (!config.meta.appId) {
    throw AppError.badRequest(
      'META_APP_ID is required to publish templates with media headers.'
    );
  }

  let response;
  try {
    response = await axios.post(
      `${config.meta.baseUrl}/${config.meta.appId}/uploads`,
      null,
      {
        params: {
          file_length: mediaRecord.size,
          file_type: mediaRecord.mime_type,
          file_name: mediaRecord.original_name,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      }
    );
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw AppError.badRequest(
      `Meta rejected the template media upload session. ${metaError?.message || err.message}`
    );
  }

  const uploadSessionId = response.data?.id;
  if (!uploadSessionId) {
    throw AppError.badRequest('Meta did not return an upload session for the template media header.');
  }

  return uploadSessionId;
}

async function uploadTemplateHeaderSample(userId, accessToken, component) {
  const fileId = trimString(component?.media_asset?.file_id);
  if (!fileId) {
    throw AppError.badRequest('Header media sample is missing its Nyife file ID.');
  }

  const mediaRecord = await fetchMediaRecord(userId, fileId);
  if (!mediaRecord) {
    throw AppError.badRequest('Header media sample could not be found.');
  }

  assertMediaRecordCompatible(component?.format, mediaRecord);

  const uploadSessionId = await createMetaUploadSession(accessToken, mediaRecord);
  const fileBuffer = await fetchMediaBinary(userId, fileId);
  let response;
  try {
    response = await axios.post(
      `${config.meta.baseUrl}/${uploadSessionId}`,
      fileBuffer,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'file_offset': '0',
          'Content-Type': mediaRecord.mime_type,
          'Content-Length': fileBuffer.length,
        },
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
  } catch (err) {
    const metaError = err.response?.data?.error;
    throw AppError.badRequest(
      `Meta rejected the uploaded template header sample. ${metaError?.message || err.message}`
    );
  }

  const headerHandle = trimString(response.data?.h);
  if (!headerHandle) {
    throw AppError.badRequest('Meta did not return a header handle for the uploaded sample media.');
  }

  return headerHandle;
}

async function resolveHeaderHandle(userId, accessToken, component) {
  const existingHandle = trimString(component?.media_asset?.header_handle)
    || trimString(component?.example?.header_handle?.[0]);

  if (existingHandle) {
    return existingHandle;
  }

  return uploadTemplateHeaderSample(userId, accessToken, component);
}

function sanitizeButtonForMeta(button) {
  const type = normalizeComponentType(button.type);
  const cleaned = { type };
  const text = trimString(button.text);

  if (text) {
    cleaned.text = text;
  }

  if (type === 'URL') {
    Object.assign(cleaned, pickDefinedEntries([
      ['url', trimString(button.url)],
      ['example', normalizeButtonExample(button.example)],
    ]));
  }

  if (type === 'PHONE_NUMBER') {
    Object.assign(cleaned, pickDefinedEntries([
      ['phone_number', trimString(button.phone_number)],
    ]));
  }

  if (type === 'OTP') {
    Object.assign(cleaned, pickDefinedEntries([
      ['otp_type', trimString(button.otp_type)],
      ['autofill_text', trimString(button.autofill_text)],
      ['package_name', trimString(button.package_name)],
      ['signature_hash', trimString(button.signature_hash)],
    ]));
  }

  if (type === 'FLOW') {
    const flowId = trimString(button.flow_id);
    const flowName = trimString(button.flow_name);
    const flowJson = trimString(button.flow_json);

    if (flowId) {
      cleaned.flow_id = flowId;
    } else if (flowName) {
      cleaned.flow_name = flowName;
    } else if (flowJson) {
      cleaned.flow_json = flowJson;
    }

    Object.assign(cleaned, pickDefinedEntries([
      ['flow_action', trimString(button.flow_action)],
      ['navigate_screen', trimString(button.navigate_screen)],
    ]));
  }

  if (type === 'CATALOG' || type === 'MPM') {
    const example = normalizeButtonExample(button.example);
    if (example) {
      cleaned.example = example;
    }
  }

  return cleaned;
}

async function sanitizeTemplateComponentsForMeta(userId, accessToken, templateType, components) {
  const sanitized = [];

  for (const component of Array.isArray(components) ? components : []) {
    const type = normalizeComponentType(component.type);

    if (type === 'HEADER') {
      const format = normalizeComponentType(component.format);
      const sanitizedHeader = {
        type: 'HEADER',
        format,
      };

      if (format === 'TEXT') {
        sanitizedHeader.text = trimString(component.text);
      }

      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
        sanitizedHeader.example = {
          header_handle: [await resolveHeaderHandle(userId, accessToken, component)],
        };
      }

      sanitized.push(sanitizedHeader);
      continue;
    }

    if (type === 'BODY') {
      if (templateType === 'authentication') {
        sanitized.push({
          type: 'BODY',
          add_security_recommendation: Boolean(component.add_security_recommendation),
        });
      } else {
        sanitized.push(pickDefinedEntries([
          ['type', templateType === 'flow' ? 'body' : 'BODY'],
          ['text', trimString(component.text)],
        ]));
      }
      continue;
    }

    if (type === 'FOOTER') {
      if (templateType === 'authentication') {
        sanitized.push({
          type: 'FOOTER',
          code_expiration_minutes: Number(component.code_expiration_minutes),
        });
      } else {
        sanitized.push(pickDefinedEntries([
          ['type', 'FOOTER'],
          ['text', trimString(component.text)],
        ]));
      }
      continue;
    }

    if (type === 'BUTTONS') {
      sanitized.push({
        type: 'BUTTONS',
        buttons: Array.isArray(component.buttons) ? component.buttons.map(sanitizeButtonForMeta) : [],
      });
      continue;
    }

    if (type === 'CAROUSEL') {
      const cards = Array.isArray(component.cards) ? component.cards : [];
      sanitized.push({
        type: 'CAROUSEL',
        cards: await Promise.all(
          cards.map(async (card) => ({
            components: await sanitizeTemplateComponentsForMeta(
              userId,
              accessToken,
              'carousel',
              Array.isArray(card.components) ? card.components : []
            ),
          }))
        ),
      });
      continue;
    }

    const generic = { ...component };
    delete generic.media_asset;

    if (Array.isArray(generic.buttons)) {
      generic.buttons = generic.buttons.map(sanitizeButtonForMeta);
    }

    if (Array.isArray(generic.cards)) {
      generic.cards = await Promise.all(
        generic.cards.map(async (card) => ({
          ...card,
          components: await sanitizeTemplateComponentsForMeta(
            userId,
            accessToken,
            'carousel',
            Array.isArray(card.components) ? card.components : []
          ),
        }))
      );
    }

    sanitized.push(generic);
  }

  return sanitized;
}

async function buildMetaTemplatePayload(userId, accessToken, template, wabaId) {
  const resolvedComponents = await resolveTemplateFlowButtons(
    userId,
    wabaId,
    template.components
  );

  return {
    name: template.name,
    language: template.language,
    category: template.category,
    components: await sanitizeTemplateComponentsForMeta(
      userId,
      accessToken,
      template.type,
      resolvedComponents
    ),
  };
}

async function resolveTemplateFlowButtons(userId, wabaId, components) {
  if (!Array.isArray(components)) {
    return components;
  }

  const resolvedComponents = [];

  for (const component of components) {
    if (component.type !== 'BUTTONS' || !Array.isArray(component.buttons)) {
      resolvedComponents.push(component);
      continue;
    }

    const resolvedButtons = [];
    for (const button of component.buttons) {
      if (button.type !== 'FLOW' || !button.flow_id || !isUuid(button.flow_id)) {
        resolvedButtons.push(button);
        continue;
      }

      const linkedFlow = await Flow.findOne({
        where: {
          id: button.flow_id,
          user_id: userId,
        },
      });

      if (!linkedFlow) {
        throw AppError.badRequest(`Linked flow ${button.flow_id} was not found for this template.`);
      }

      if (wabaId && linkedFlow.waba_id && String(linkedFlow.waba_id) !== String(wabaId)) {
        throw AppError.badRequest(
          `Linked flow "${linkedFlow.name}" belongs to WABA ${linkedFlow.waba_id}, but the template is being published for WABA ${wabaId}.`
        );
      }

      if (!linkedFlow.meta_flow_id) {
        throw AppError.badRequest(
          `Linked flow "${linkedFlow.name}" must be saved to Meta before this template can be published.`
        );
      }

      const firstScreenId = linkedFlow.json_definition?.screens?.[0]?.id || undefined;

      resolvedButtons.push({
        ...button,
        flow_id: linkedFlow.meta_flow_id,
        flow_action: button.flow_action || 'navigate',
        navigate_screen: button.navigate_screen || firstScreenId,
        flow_name: undefined,
        flow_json: undefined,
      });
    }

    resolvedComponents.push({
      ...component,
      buttons: resolvedButtons,
    });
  }

  return resolvedComponents;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function getMetaManagedTemplateChanges(template, data) {
  return {
    categoryChanged: data.category !== undefined && data.category !== template.category,
    componentsChanged: data.components !== undefined,
  };
}

function assertMetaTemplateUpdateAllowed(template, data, nextWaAccountId) {
  const disallowedFields = [];

  if (data.name !== undefined && data.name !== template.name) {
    disallowedFields.push('name');
  }

  if (data.language !== undefined && data.language !== template.language) {
    disallowedFields.push('language');
  }

  if (data.type !== undefined && data.type !== template.type) {
    disallowedFields.push('type');
  }

  if (data.wa_account_id !== undefined && nextWaAccountId !== template.wa_account_id) {
    disallowedFields.push('wa_account_id');
  }

  if (
    resolveTemplateMetaStatus(template) === 'APPROVED'
    && data.category !== undefined
    && data.category !== template.category
  ) {
    disallowedFields.push('category');
  }

  if (disallowedFields.length) {
    throw AppError.badRequest(
      `Meta-managed templates cannot update these fields in the current state: ${disallowedFields.join(', ')}.`
    );
  }
}

function serializeTemplate(template) {
  const record = typeof template.toJSON === 'function' ? template.toJSON() : { ...template };
  record.meta_status_raw = resolveTemplateMetaStatus(record);
  record.quality_score = extractQualityScore(record);
  record.quality_reasons = extractQualityReasons(record);

  if (record.meta_template_id && record.meta_status_raw) {
    record.status = deriveLocalTemplateStatus(record.meta_status_raw, record.status);
  }

  return {
    ...record,
    available_actions: getTemplateAvailableActions(record),
  };
}

// ─── Create Template ───────────────────────────────────────────────────────

/**
 * Creates a new template in draft status.
 *
 * @param {string} userId
 * @param {object} data - Validated template data
 * @returns {Promise<object>} The created template
 */
async function createTemplate(userId, data) {
  // Check subscription limit before creating
  await checkSubscriptionLimit(userId);
  const activeAccount = await requireAutoResolvedWaAccount(
    userId,
    data.wa_account_id,
    'creating a template'
  );
  const resolvedWabaId = String(activeAccount.waba_id);

  assertTemplateBusinessRules({
    ...data,
    waba_id: resolvedWabaId,
  });

  // Check name uniqueness scoped to user + waba_id
  const whereClause = {
    user_id: userId,
    name: data.name,
  };
  whereClause.waba_id = resolvedWabaId;

  const existingTemplate = await Template.findOne({ where: whereClause });
  if (existingTemplate) {
    throw AppError.conflict(
      `A template with the name "${data.name}" already exists for WABA ${resolvedWabaId}`
    );
  }

  const template = await Template.create({
    user_id: userId,
    waba_id: resolvedWabaId,
    wa_account_id: activeAccount.id,
    name: data.name,
    display_name: data.display_name || null,
    language: data.language || 'en_US',
    category: data.category,
    type: data.type || 'standard',
    status: 'draft',
    source: 'nyife',
    components: data.components,
    example_values: data.example_values || null,
  });

  // Notify subscription service (best-effort)
  notifySubscriptionUsage(userId, 'increment');

  return serializeTemplate(template);
}

// ─── List Templates ────────────────────────────────────────────────────────

/**
 * Lists templates for a user with optional filtering, search, and pagination.
 *
 * @param {string} userId
 * @param {object} filters - { page, limit, status, category, type, search, waba_id }
 * @returns {Promise<{ templates: Array, meta: object }>}
 */
async function listTemplates(userId, filters) {
  const { page, limit, status, category, type, search, waba_id, wa_account_id, date_from, date_to } = filters;
  const { offset, limit: sanitizedLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (status) {
    where.status = status;
  }
  if (category) {
    where.category = category;
  }
  if (type) {
    where.type = type;
  }
  if (waba_id) {
    where.waba_id = waba_id;
  }
  if (wa_account_id) {
    where.wa_account_id = wa_account_id;
  }
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { display_name: { [Op.like]: `%${search}%` } },
    ];
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

  const { count, rows } = await Template.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: sanitizedLimit,
    offset,
  });

  const meta = getPaginationMeta(count, page, sanitizedLimit);

  return {
    templates: rows.map(serializeTemplate),
    meta,
  };
}

// ─── Get Template ──────────────────────────────────────────────────────────

/**
 * Retrieves a single template by ID, scoped by user.
 *
 * @param {string} userId
 * @param {string} templateId
 * @returns {Promise<object>} The template
 */
async function getTemplate(userId, templateId) {
  const template = await Template.findOne({
    where: { id: templateId, user_id: userId },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  return serializeTemplate(template);
}

// ─── Update Template ───────────────────────────────────────────────────────

/**
 * Updates a template using either the local draft workflow or Meta's edit API,
 * depending on whether the template has already been created on Meta.
 *
 * @param {string} userId
 * @param {string} templateId
 * @param {object} data - Validated update data
 * @returns {Promise<object>} The updated template
 */
async function updateTemplate(userId, templateId, data) {
  const template = await Template.findOne({
    where: { id: templateId, user_id: userId },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  if (!canEditTemplate(template)) {
    throw AppError.badRequest(
      `Cannot edit a template with status "${template.status}".`
    );
  }

  let nextWaAccountId = template.wa_account_id;
  let nextWabaId = template.waba_id;

  if (data.wa_account_id !== undefined) {
    if (data.wa_account_id) {
      const activeAccount = await requireActiveWaAccount(userId, data.wa_account_id);
      nextWaAccountId = activeAccount.id;
      nextWabaId = String(activeAccount.waba_id);
    } else {
      nextWaAccountId = null;
    }
  }

  const nextName = data.name !== undefined ? data.name : template.name;

  // If the destination name or WABA changes, check uniqueness in the destination scope
  if (nextName !== template.name || nextWabaId !== template.waba_id) {
    const whereClause = {
      user_id: userId,
      name: nextName,
      id: { [Op.ne]: templateId },
    };
    if (nextWabaId) {
      whereClause.waba_id = nextWabaId;
    } else {
      whereClause.waba_id = { [Op.is]: null };
    }

    const existing = await Template.findOne({ where: whereClause });
    if (existing) {
      throw AppError.conflict(
        `A template with the name "${nextName}" already exists${nextWabaId ? ` for WABA ${nextWabaId}` : ''}`
      );
    }
  }

  const nextTemplateState = {
    ...template.toJSON(),
    ...data,
    components: data.components !== undefined ? data.components : template.components,
    type: data.type !== undefined ? data.type : template.type,
    category: data.category !== undefined ? data.category : template.category,
    language: data.language !== undefined ? data.language : template.language,
    wa_account_id: nextWaAccountId,
    waba_id: nextWabaId,
  };
  assertTemplateBusinessRules(nextTemplateState);

  const localOnlyUpdateFields = {};
  if (data.display_name !== undefined) localOnlyUpdateFields.display_name = data.display_name;
  if (data.example_values !== undefined) localOnlyUpdateFields.example_values = data.example_values;

  const isMetaLinkedTemplate = Boolean(
    template.meta_template_id && resolveTemplateMetaStatus(template)
  );

  if (isMetaLinkedTemplate) {
    assertMetaTemplateUpdateAllowed(template, data, nextWaAccountId);

    const managedChanges = getMetaManagedTemplateChanges(template, data);
    const hasMetaManagedChanges = managedChanges.categoryChanged || managedChanges.componentsChanged;

    if (!hasMetaManagedChanges) {
      if (Object.keys(localOnlyUpdateFields).length > 0) {
        await template.update(localOnlyUpdateFields);
      }
      return serializeTemplate(template);
    }

    const accountContext = await resolveAccountContext(userId, {
      waAccountId: template.wa_account_id,
      wabaId: template.waba_id,
      allowFallbackByWaba: true,
    });

    if (!accountContext) {
      throw AppError.badRequest(
        'WhatsApp access token is required for editing a Meta template. Configure META_SYSTEM_USER_ACCESS_TOKEN or connect an active WhatsApp account for this WABA.'
      );
    }

    const wabaId = String(accountContext.waba_id);
    if (template.waba_id && String(template.waba_id) !== wabaId) {
      throw AppError.badRequest(
        `The connected WhatsApp account belongs to WABA ${wabaId}, but this template is scoped to WABA ${template.waba_id}.`
      );
    }

    const metaEditableTemplate = {
      ...template.toJSON(),
      category: data.category !== undefined ? data.category : template.category,
      components: data.components !== undefined ? data.components : template.components,
      wa_account_id: accountContext.wa_account_id || template.wa_account_id,
      waba_id: wabaId,
    };

    const payload = await buildMetaTemplatePayload(
      userId,
      accountContext.access_token,
      metaEditableTemplate,
      wabaId
    );

    try {
      await axios.post(
        `${config.meta.baseUrl}/${template.meta_template_id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accountContext.access_token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
    } catch (err) {
      const metaError = err.response?.data?.error;
      throw AppError.badRequest(
        `Meta API error: ${metaError?.message || err.message}`
      );
    }

    let refreshedTemplate = null;
    try {
      refreshedTemplate = await fetchMetaTemplateById(
        template.meta_template_id,
        accountContext.access_token
      );
    } catch (err) {
      console.warn(
        '[template-service] Could not refresh edited template from Meta:',
        err.response?.data?.error?.message || err.message
      );
    }

    const updateFields = refreshedTemplate
      ? mapMetaTemplateToLocalState(refreshedTemplate, {
          wabaId,
          waAccountId: accountContext.wa_account_id || template.wa_account_id,
          metaTemplateId: template.meta_template_id,
        })
      : {
          category: data.category !== undefined ? data.category : template.category,
          components: data.components !== undefined ? data.components : template.components,
          status: 'pending',
          meta_status_raw: 'PENDING',
          waba_id: wabaId,
          wa_account_id: accountContext.wa_account_id || template.wa_account_id,
          last_synced_at: new Date(),
        };

    await template.update({
      ...updateFields,
      ...localOnlyUpdateFields,
    });

    return serializeTemplate(template);
  }

  // Build the update object only with provided fields
  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.display_name !== undefined) updateFields.display_name = data.display_name;
  if (data.language !== undefined) updateFields.language = data.language;
  if (data.category !== undefined) updateFields.category = data.category;
  if (data.type !== undefined) updateFields.type = data.type;
  if (data.components !== undefined) updateFields.components = data.components;
  if (data.example_values !== undefined) updateFields.example_values = data.example_values;
  if (data.wa_account_id !== undefined) updateFields.wa_account_id = nextWaAccountId;
  if (data.wa_account_id !== undefined && nextWabaId) updateFields.waba_id = nextWabaId;

  if (template.status === 'rejected' && !template.meta_template_id) {
    updateFields.status = 'draft';
    updateFields.rejection_reason = null;
    updateFields.meta_status_raw = null;
  }

  await template.update(updateFields);

  return serializeTemplate(template);
}

// ─── Delete Template ───────────────────────────────────────────────────────

/**
 * Soft-deletes a template. If the template has been published to Meta (has meta_template_id),
 * also deletes it from Meta's platform.
 *
 * @param {string} userId
 * @param {string} templateId
 * @param {string|null} accessToken - Meta access token, required if template is published
 * @returns {Promise<void>}
 */
async function deleteTemplate(userId, templateId, accessToken) {
  const template = await Template.findOne({
    where: { id: templateId, user_id: userId },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  if (!canDeleteTemplate(template)) {
    throw AppError.badRequest('Disabled Meta templates cannot be deleted.');
  }

  const metaStatusRaw = resolveTemplateMetaStatus(template);

  // If the template has been published to Meta, delete from Meta first
  if (template.meta_template_id && template.waba_id && metaStatusRaw !== 'PENDING_DELETION') {
    const accountContext = await resolveAccountContext(userId, {
      waAccountId: template.wa_account_id,
      wabaId: template.waba_id,
      providedAccessToken: accessToken,
      allowFallbackByWaba: true,
    });

    if (!accountContext) {
      throw AppError.badRequest(
        'WhatsApp access token is required to delete a published template. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
      );
    }

    try {
      await axios.delete(
        `${config.meta.baseUrl}/${accountContext.waba_id}/message_templates`,
        {
          params: pickDefinedEntries([
            ['name', template.name],
            ['hsm_id', template.meta_template_id || undefined],
          ]),
          headers: {
            Authorization: `Bearer ${accountContext.access_token}`,
          },
          timeout: 10000,
        }
      );
    } catch (err) {
      const metaError = err.response?.data?.error;
      // If Meta returns 100 (invalid parameter) it likely means template was already deleted
      if (metaError && metaError.code !== 100) {
        throw AppError.badRequest(
          `Failed to delete template from Meta: ${metaError.message || err.message}`
        );
      }
      // Otherwise log and continue with local deletion
      console.warn(
        '[template-service] Meta template deletion warning:',
        metaError?.message || err.message
      );
    }
  }

  // Soft delete locally
  await template.destroy();

  if (didTemplateConsumeQuota(template)) {
    // Notify subscription service (best-effort)
    notifySubscriptionUsage(userId, 'decrement');
  }
}

// ─── Publish Template ──────────────────────────────────────────────────────

/**
 * Publishes a draft template to Meta WhatsApp Cloud API.
 * Sends the template to Meta for review and updates local status to 'pending'.
 *
 * @param {string} userId
 * @param {string} templateId
 * @param {string} accessToken - Meta WhatsApp access token
 * @param {string|null} waAccountIdOverride - Optional WhatsApp account override from request body
 * @returns {Promise<object>} The updated template with meta_template_id
 */
async function publishTemplate(userId, templateId, accessToken, waAccountIdOverride) {
  const template = await Template.findOne({
    where: { id: templateId, user_id: userId },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  if (!canPublishTemplate(template)) {
    throw AppError.badRequest(
      `Cannot publish a template with status "${template.status}".`
    );
  }

  const accountContext = await resolveAccountContext(userId, {
    waAccountId: waAccountIdOverride || template.wa_account_id,
    wabaId: template.waba_id,
    providedAccessToken: accessToken,
    allowFallbackByWaba: true,
  });

  if (!accountContext) {
    throw AppError.badRequest(
      'WhatsApp access token is required for publishing. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
    );
  }

  const wabaId = String(accountContext.waba_id);
  if (template.waba_id && String(template.waba_id) !== wabaId) {
    throw AppError.badRequest(
      `The selected WhatsApp account belongs to WABA ${wabaId}, but this template is scoped to WABA ${template.waba_id}.`
    );
  }

  assertTemplateBusinessRules({
    ...template.toJSON(),
    wa_account_id: accountContext.wa_account_id,
    waba_id: wabaId,
  });

  // Build Meta API payload
  const payload = await buildMetaTemplatePayload(
    userId,
    accountContext.access_token,
    template,
    wabaId
  );

  // Include example values if present (needed for templates with media headers or variables)
  // Meta expects examples within components, but some are passed at the top level
  // The components array should already contain any example fields within each component

  let metaResponse;
  try {
    metaResponse = await axios.post(
      `${config.meta.baseUrl}/${wabaId}/message_templates`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accountContext.access_token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
  } catch (err) {
    const metaError = err.response?.data?.error;
    if (metaError) {
      throw AppError.badRequest(
        `Meta API error: ${metaError.message || 'Unknown error'}${metaError.error_user_title ? ` - ${metaError.error_user_title}` : ''}` +
        `${metaError.error_user_msg ? `. ${metaError.error_user_msg}` : ''}`
      );
    }
    throw AppError.badRequest(`Failed to publish template to Meta: ${err.message}`);
  }

  // Extract template ID from Meta response
  const metaTemplateId = metaResponse.data?.id;
  const metaStatus = normalizeMetaTemplateStatus(metaResponse.data?.status) || 'PENDING';
  const nextStatus = deriveLocalTemplateStatus(metaStatus, 'pending');
  const rejectionReason = metaStatus === 'REJECTED'
    ? extractRejectionReason(metaResponse.data)
    : null;

  // Update local template record
  const updateData = {
    status: nextStatus,
    meta_template_id: metaTemplateId || null,
    meta_status_raw: metaStatus,
    quality_score: null,
    quality_reasons: null,
    rejection_reason: rejectionReason,
    waba_id: wabaId,
    wa_account_id: accountContext.wa_account_id || template.wa_account_id,
    last_synced_at: new Date(),
  };

  await template.update(updateData);

  return serializeTemplate(template);
}

// ─── Sync Templates ────────────────────────────────────────────────────────

/**
 * Syncs templates from Meta WhatsApp Cloud API for a given WABA ID.
 * Fetches all templates from Meta and updates local records with current status.
 * Also creates local records for templates that exist on Meta but not locally.
 *
 * @param {string} userId
 * @param {string} waAccountId - WhatsApp account ID
 * @param {string} accessToken - Meta WhatsApp access token
 * @returns {Promise<{ synced: number, created: number, updated: number }>}
 */
async function syncTemplates(userId, waAccountId, accessToken) {
  const accountContext = await resolveAccountContext(userId, {
    waAccountId,
    providedAccessToken: accessToken,
    allowFallbackByWaba: false,
  });

  if (!accountContext) {
    throw AppError.badRequest(
      'Select an active WhatsApp account before syncing templates.'
    );
  }

  const wabaId = String(accountContext.waba_id);

  if (!wabaId) {
    throw AppError.badRequest('WABA ID is required for syncing templates.');
  }

  // Fetch all templates from Meta
  let metaTemplates = [];
  let nextUrl = `${config.meta.baseUrl}/${wabaId}/message_templates`;
  let requestParams = {
    limit: 100,
    fields: META_TEMPLATE_FIELDS,
  };

  try {
    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        params: requestParams,
        headers: {
          Authorization: `Bearer ${accountContext.access_token}`,
        },
        timeout: 15000,
      });

      if (response.data?.data) {
        metaTemplates = metaTemplates.concat(response.data.data);
      }

      // Handle pagination from Meta API
      nextUrl = response.data?.paging?.next || null;
      requestParams = undefined;
    }
  } catch (err) {
    const metaError = err.response?.data?.error;
    if (metaError) {
      throw AppError.badRequest(
        `Meta API error while fetching templates: ${metaError.message || 'Unknown error'}`
      );
    }
    throw AppError.badRequest(`Failed to fetch templates from Meta: ${err.message}`);
  }

  let created = 0;
  let updated = 0;

  for (const metaTemplate of metaTemplates) {
    const metaId = metaTemplate.id;
    const metaName = metaTemplate.name;

    // Try to find existing local template by meta_template_id
    let localTemplate = await Template.findOne({
      where: {
        user_id: userId,
        meta_template_id: metaId,
      },
    });

    // If not found by meta_template_id, try matching by name + waba_id
    if (!localTemplate) {
      localTemplate = await Template.findOne({
        where: {
          user_id: userId,
          waba_id: wabaId,
          name: metaName,
        },
      });
    }

    if (localTemplate) {
      const updateData = {
        ...mapMetaTemplateToLocalState(metaTemplate, {
          wabaId,
          waAccountId: accountContext.wa_account_id,
          metaTemplateId: metaId,
        }),
        waba_id: wabaId,
        wa_account_id: accountContext.wa_account_id,
      };

      if (!localTemplate.source && !localTemplate.meta_template_id) {
        updateData.source = 'meta_sync';
      }

      await localTemplate.update(updateData);
      updated++;
    } else {
      // Create new local record for template that exists on Meta but not locally
      const syncedState = mapMetaTemplateToLocalState(metaTemplate, {
        wabaId,
        waAccountId: accountContext.wa_account_id,
        metaTemplateId: metaId,
      });
      await Template.create({
        user_id: userId,
        waba_id: wabaId,
        wa_account_id: accountContext.wa_account_id,
        name: metaName,
        display_name: metaName.replace(/_/g, ' '),
        language: syncedState.language,
        category: syncedState.category,
        type: syncedState.type,
        status: syncedState.status,
        source: 'meta_sync',
        components: syncedState.components,
        meta_template_id: metaId,
        meta_status_raw: syncedState.meta_status_raw,
        quality_score: syncedState.quality_score,
        quality_reasons: syncedState.quality_reasons,
        rejection_reason: syncedState.rejection_reason,
        last_synced_at: syncedState.last_synced_at,
      });
      created++;
    }
  }

  return {
    synced: metaTemplates.length,
    created,
    updated,
  };
}

// ─── Helper: detect template type from components ──────────────────────────

/**
 * Attempts to detect the template type from its components structure.
 *
 * @param {Array} components - Template components array from Meta
 * @returns {string} The detected template type
 */
function detectTemplateType(components) {
  if (!Array.isArray(components) || components.length === 0) {
    return 'standard';
  }

  // Check for carousel card
  const hasCarousel = components.some((c) => c.type === 'CAROUSEL');
  if (hasCarousel) {
    return 'carousel';
  }

  // Check for authentication OTP buttons
  const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
  if (buttonsComponent && buttonsComponent.buttons) {
    const hasOtp = buttonsComponent.buttons.some((b) => b.type === 'OTP');
    if (hasOtp) {
      return 'authentication';
    }

    const hasFlow = buttonsComponent.buttons.some((b) => b.type === 'FLOW');
    if (hasFlow) {
      return 'flow';
    }

    const hasCatalog = buttonsComponent.buttons.some((b) => b.type === 'CATALOG');
    const hasMpm = buttonsComponent.buttons.some((b) => b.type === 'MPM');
    if (hasCatalog || hasMpm) {
      return 'list_menu';
    }
  }

  // Check for body with add_security_recommendation (auth template)
  const bodyComponent = components.find((c) => c.type === 'BODY');
  if (bodyComponent && bodyComponent.add_security_recommendation !== undefined) {
    return 'authentication';
  }

  return 'standard';
}

module.exports = {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  publishTemplate,
  syncTemplates,
  resolveAccountContext,
  applyTemplateStatusEvent,
};
