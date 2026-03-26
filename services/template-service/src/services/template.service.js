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
  normalizeMetaButtonOrder,
} = require('../helpers/templateRules');
const {
  buildBodyTextExample,
  buildHeaderTextExample,
  buildUrlButtonExample,
} = require('../helpers/templateExamples');
const { buildInternalOrganizationHeaders } = require('../helpers/templateRequestContext');
const {
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
  'message_send_ttl_seconds',
  'quality_score',
  'rejected_reason',
].join(',');

function resolveScopeId(requestContext) {
  if (typeof requestContext === 'string') {
    return requestContext;
  }

  return requestContext?.scopeId || null;
}

function buildMediaServiceHeaders(requestContext) {
  const headers = buildInternalOrganizationHeaders(requestContext);

  if (!headers['x-user-id']) {
    throw AppError.badRequest(
      'Authenticated actor context is required to load template media samples from Nyife media storage.'
    );
  }

  return headers;
}

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
  const reasons = data?.quality_score?.reasons || data?.quality_reasons || data?.qualityReasons || [];
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

function normalizeMessageSendTtl(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function mapMetaTemplateToLocalState(metaTemplate, context = {}) {
  const rawMetaStatus = trimString(metaTemplate?.status || metaTemplate?.meta_status_raw).toUpperCase();
  const metaStatusRaw = normalizeMetaTemplateStatus(rawMetaStatus) || rawMetaStatus || null;
  const qualityScore = extractQualityScore(metaTemplate);
  const qualityReasons = extractQualityReasons(metaTemplate);
  const rejectionReason = extractRejectionReason(metaTemplate);
  const messageSendTtlSeconds = normalizeMessageSendTtl(metaTemplate?.message_send_ttl_seconds);

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
    message_send_ttl_seconds: messageSendTtlSeconds,
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

async function findTemplateByMetaIdentifiers({
  userId = null,
  metaTemplateId,
  templateName,
  templateLanguage,
  wabaId,
}) {
  const scopedUserFilter = userId ? { user_id: userId } : {};

  if (metaTemplateId) {
    return Template.findOne({
      where: {
        ...scopedUserFilter,
        meta_template_id: metaTemplateId,
      },
    });
  }

  const normalizedName = trimString(templateName);
  const normalizedWabaId = wabaId ? String(wabaId) : null;
  const normalizedLanguage = trimString(templateLanguage);

  if (!normalizedName || !normalizedWabaId) {
    return null;
  }

  if (normalizedLanguage) {
    return Template.findOne({
      where: {
        ...scopedUserFilter,
        waba_id: normalizedWabaId,
        name: normalizedName,
        language: normalizedLanguage,
      },
    });
  }

  const matches = await Template.findAll({
    where: {
      ...scopedUserFilter,
      waba_id: normalizedWabaId,
      name: normalizedName,
    },
    order: [['updated_at', 'DESC']],
    limit: 2,
  });

  return matches.length === 1 ? matches[0] : null;
}

async function applyTemplateQualityEvent(event) {
  const userId = event.userId || event.user_id || null;
  const metaTemplateId = event.messageTemplateId || event.message_template_id || null;
  const templateName = event.messageTemplateName || event.message_template_name || null;
  const templateLanguage = event.messageTemplateLanguage || event.message_template_language || null;
  const wabaId = event.wabaId || event.waba_id || null;
  const qualityScore = extractQualityScore(event);
  const qualityReasons = extractQualityReasons(event);

  if (!qualityScore) {
    throw AppError.badRequest('Template quality event is missing the new quality score.');
  }

  if (!metaTemplateId && (!templateName || !wabaId)) {
    throw AppError.badRequest('Template quality event is missing required identifiers.');
  }

  const template = await findTemplateByMetaIdentifiers({
    userId,
    metaTemplateId,
    templateName,
    templateLanguage,
    wabaId,
  });

  if (!template) {
    return null;
  }

  await template.update({
    quality_score: qualityScore,
    quality_reasons: qualityReasons,
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

  const userId = event.userId || event.user_id || null;
  const metaTemplateId = event.messageTemplateId || event.message_template_id || null;
  const templateName = event.messageTemplateName || event.message_template_name || null;
  const templateLanguage = event.messageTemplateLanguage || event.message_template_language || null;
  const wabaId = event.wabaId || event.waba_id || null;
  const normalizedStatus = normalizeMetaTemplateStatus(event.status || event.event);

  if ((!metaTemplateId && (!templateName || !wabaId)) || !normalizedStatus) {
    throw AppError.badRequest('Template status event is missing required identifiers.');
  }

  const template = await findTemplateByMetaIdentifiers({
    userId,
    metaTemplateId,
    templateName,
    templateLanguage,
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
  const selection = await resolveSingleWabaAccount(userId, {
    waAccountId,
    allowAutoResolve: false,
  });
  const account = selection.account || null;
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

function isAuthenticationTemplate(template) {
  return String(template?.type || '').toLowerCase() === 'authentication'
    || String(template?.category || '').toUpperCase() === 'AUTHENTICATION';
}

function normalizeAuthenticationSupportedApps(button) {
  const apps = Array.isArray(button?.supported_apps)
    ? button.supported_apps
        .map((app) => pickDefinedEntries([
          ['package_name', trimString(app?.package_name)],
          ['signature_hash', trimString(app?.signature_hash)],
        ]))
        .filter((app) => Object.keys(app).length)
    : [];

  if (apps.length) {
    return apps;
  }

  const legacyApp = pickDefinedEntries([
    ['package_name', trimString(button?.package_name)],
    ['signature_hash', trimString(button?.signature_hash)],
  ]);

  return Object.keys(legacyApp).length ? [legacyApp] : undefined;
}

function extractAuthenticationUpsertResult(responseData, templateLanguage) {
  const entries = [
    ...(Array.isArray(responseData?.data) ? responseData.data : []),
    ...(Array.isArray(responseData?.templates) ? responseData.templates : []),
    ...(Array.isArray(responseData?.results) ? responseData.results : []),
  ];

  if (!entries.length && responseData && typeof responseData === 'object') {
    const singleEntryLanguage = trimString(responseData?.language || responseData?.locale);
    if (singleEntryLanguage || responseData?.id || responseData?.message_template_id || responseData?.template_id) {
      entries.push(responseData);
    }
  }

  if (!entries.length) {
    return null;
  }

  const normalizedLanguage = trimString(templateLanguage);
  return entries.find((entry) => trimString(entry?.language || entry?.locale) === normalizedLanguage) || entries[0] || null;
}

function extractMetaTemplateIdentifier(value) {
  return trimString(
    value?.id
      || value?.message_template_id
      || value?.template_id
      || value?.hsm_id
  ) || null;
}

async function submitAuthenticationTemplateUpsert(accessToken, wabaId, payload, templateLanguage) {
  const response = await axios.post(
    `${config.meta.baseUrl}/${wabaId}/upsert_message_templates`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return {
    responseData: response.data,
    result: extractAuthenticationUpsertResult(response.data, templateLanguage),
  };
}

async function listMetaTemplatesForWaba(wabaId, accessToken) {
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
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      });

      if (response.data?.data) {
        metaTemplates = metaTemplates.concat(response.data.data);
      }

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

  return metaTemplates;
}

function matchesRemoteTemplate(remoteTemplate, templateName, templateLanguage) {
  const normalizedName = trimString(templateName);
  const normalizedLanguage = trimString(templateLanguage);

  if (!normalizedName) {
    return false;
  }

  if (trimString(remoteTemplate?.name) !== normalizedName) {
    return false;
  }

  if (normalizedLanguage && trimString(remoteTemplate?.language) !== normalizedLanguage) {
    return false;
  }

  return true;
}

async function findRemoteMetaTemplate({
  accessToken,
  wabaId,
  metaTemplateId = null,
  templateName = null,
  templateLanguage = null,
}) {
  const normalizedMetaTemplateId = trimString(metaTemplateId);

  if (normalizedMetaTemplateId) {
    try {
      const remoteTemplate = await fetchMetaTemplateById(normalizedMetaTemplateId, accessToken);
      if (!templateName || matchesRemoteTemplate(remoteTemplate, templateName, templateLanguage)) {
        return remoteTemplate;
      }
    } catch (err) {
      const metaError = err.response?.data?.error;
      if (!metaError || Number(metaError.code) !== 100) {
        throw err;
      }
    }
  }

  const normalizedWabaId = trimString(wabaId);
  if (!normalizedWabaId || !trimString(templateName)) {
    return null;
  }

  const remoteTemplates = await listMetaTemplatesForWaba(normalizedWabaId, accessToken);
  const matches = remoteTemplates.filter((remoteTemplate) =>
    matchesRemoteTemplate(remoteTemplate, templateName, templateLanguage)
  );

  if (!matches.length) {
    return null;
  }

  if (normalizedMetaTemplateId) {
    const exactIdMatch = matches.find((remoteTemplate) => trimString(remoteTemplate?.id) === normalizedMetaTemplateId);
    if (exactIdMatch) {
      return exactIdMatch;
    }
  }

  return matches[0];
}

function hasMetaManagementHint(template) {
  return Boolean(
    template?.meta_template_id
    || resolveTemplateMetaStatus(template)
    || template?.source === 'meta_sync'
  );
}

async function reconcileMetaTemplateLinkage(requestContext, template, accessToken = null, options = {}) {
  const {
    requireAccountContext = false,
    requireRemoteTemplate = false,
  } = options;

  const existingMetaStatus = resolveTemplateMetaStatus(template);
  const existingMetaTemplateId = trimString(template?.meta_template_id) || null;
  const existingWabaId = trimString(template?.waba_id) || null;

  if (!hasMetaManagementHint(template) && !requireAccountContext && !requireRemoteTemplate) {
    return {
      accountContext: null,
      remoteTemplate: null,
      metaTemplateId: existingMetaTemplateId,
      metaStatusRaw: existingMetaStatus,
      wabaId: existingWabaId,
    };
  }

  const userId = resolveScopeId(requestContext);
  const accountContext = await resolveAccountContext(userId, {
    waAccountId: template?.wa_account_id,
    wabaId: template?.waba_id,
    providedAccessToken: accessToken,
    allowFallbackByWaba: true,
  });

  if (!accountContext) {
    if (requireAccountContext || requireRemoteTemplate) {
      throw AppError.badRequest(
        'WhatsApp access token is required to verify and manage this Meta template. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
      );
    }

    return {
      accountContext: null,
      remoteTemplate: null,
      metaTemplateId: existingMetaTemplateId,
      metaStatusRaw: existingMetaStatus,
      wabaId: existingWabaId,
    };
  }

  const wabaId = trimString(accountContext.waba_id) || existingWabaId;
  const remoteTemplate = await findRemoteMetaTemplate({
    accessToken: accountContext.access_token,
    wabaId,
    metaTemplateId: existingMetaTemplateId,
    templateName: template?.name,
    templateLanguage: template?.language,
  });

  if (!remoteTemplate && requireRemoteTemplate) {
    throw AppError.badRequest(
      'Could not verify this template on Meta. Sync templates from Meta and try again.'
    );
  }

  const remoteMetaTemplateId = trimString(remoteTemplate?.id) || existingMetaTemplateId;
  const remoteMetaStatus = normalizeMetaTemplateStatus(remoteTemplate?.status)
    || trimString(remoteTemplate?.status).toUpperCase()
    || existingMetaStatus;

  if (remoteTemplate) {
    const linkagePatch = pickDefinedEntries([
      ['meta_template_id', remoteMetaTemplateId !== existingMetaTemplateId ? remoteMetaTemplateId : undefined],
      ['meta_status_raw', remoteMetaStatus && remoteMetaStatus !== template?.meta_status_raw ? remoteMetaStatus : undefined],
      ['waba_id', wabaId && wabaId !== existingWabaId ? wabaId : undefined],
      [
        'wa_account_id',
        accountContext.wa_account_id && accountContext.wa_account_id !== template?.wa_account_id
          ? accountContext.wa_account_id
          : undefined,
      ],
    ]);

    if (Object.keys(linkagePatch).length) {
      linkagePatch.last_synced_at = new Date();
      await template.update(linkagePatch);
    }
  }

  return {
    accountContext,
    remoteTemplate,
    metaTemplateId: remoteMetaTemplateId || null,
    metaStatusRaw: remoteMetaStatus || null,
    wabaId: wabaId || null,
  };
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

function normalizeTemplateComponentsForMetaCompatibility(components) {
  return (Array.isArray(components) ? components : []).map((component) => {
    const normalizedType = normalizeComponentType(component?.type);

    if (normalizedType === 'BUTTONS') {
      return {
        ...component,
        buttons: normalizeMetaButtonOrder(
          Array.isArray(component.buttons)
            ? component.buttons.map((button) => ({ ...button }))
            : []
        ),
      };
    }

    if (normalizedType === 'CAROUSEL') {
      return {
        ...component,
        cards: Array.isArray(component.cards)
          ? component.cards.map((card) => ({
              ...card,
              components: normalizeTemplateComponentsForMetaCompatibility(card.components),
            }))
          : [],
      };
    }

    return { ...component };
  });
}

async function fetchMediaRecord(userId, fileId) {
  try {
    const response = await axios.get(
      `${config.mediaServiceUrl}/api/v1/media/${fileId}`,
      {
        headers: buildMediaServiceHeaders(userId),
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
        headers: buildMediaServiceHeaders(userId),
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

  if (text && type !== 'OTP') {
    cleaned.text = text;
  }

  if (type === 'URL') {
    const buttonUrl = trimString(button.url);
    Object.assign(cleaned, pickDefinedEntries([
      ['url', buttonUrl],
      ['example', buildUrlButtonExample(buttonUrl, button.example)],
    ]));
  }

  if (type === 'PHONE_NUMBER') {
    Object.assign(cleaned, pickDefinedEntries([
      ['phone_number', trimString(button.phone_number)],
    ]));
  }

  if (type === 'OTP') {
    const otpType = trimString(button.otp_type);
    Object.assign(cleaned, pickDefinedEntries([
      ['otp_type', otpType],
      ['supported_apps', otpType !== 'COPY_CODE' ? normalizeAuthenticationSupportedApps(button) : undefined],
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
        const headerTextExample = buildHeaderTextExample(
          component.text,
          component?.example?.header_text
        );
        if (headerTextExample) {
          sanitizedHeader.example = {
            header_text: headerTextExample,
          };
        }
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
        const bodyTextExample = buildBodyTextExample(
          component.text,
          component?.example?.body_text?.[0]
        );

        sanitized.push(pickDefinedEntries([
          ['type', 'BODY'],
          ['text', trimString(component.text)],
          ['example', bodyTextExample ? { body_text: bodyTextExample } : undefined],
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
        buttons: normalizeMetaButtonOrder(
          Array.isArray(component.buttons) ? component.buttons : []
        ).map(sanitizeButtonForMeta),
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
      generic.buttons = normalizeMetaButtonOrder(generic.buttons).map(sanitizeButtonForMeta);
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

async function buildMetaTemplatePayload(userId, accessToken, template, wabaId, options = {}) {
  const { includeIdentity = true } = options;
  const resolvedComponents = await resolveTemplateFlowButtons(
    resolveScopeId(userId),
    wabaId,
    template.components
  );
  const normalizedComponents = normalizeTemplateComponentsForMetaCompatibility(resolvedComponents);
  const sanitizedComponents = await sanitizeTemplateComponentsForMeta(
    userId,
    accessToken,
    template.type,
    normalizedComponents
  );

  if (isAuthenticationTemplate(template)) {
    return {
      name: template.name,
      languages: [template.language],
      category: 'AUTHENTICATION',
      components: sanitizedComponents,
      ...(normalizeMessageSendTtl(template.message_send_ttl_seconds)
        ? { message_send_ttl_seconds: normalizeMessageSendTtl(template.message_send_ttl_seconds) }
        : {}),
    };
  }

  return {
    ...(includeIdentity
      ? {
          allow_category_change: true,
          name: template.name,
          language: template.language,
        }
      : {}),
    category: template.category,
    components: sanitizedComponents,
    ...(normalizeMessageSendTtl(template.message_send_ttl_seconds)
      ? { message_send_ttl_seconds: normalizeMessageSendTtl(template.message_send_ttl_seconds) }
      : {}),
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

function areJsonValuesEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function getMetaManagedTemplateChanges(template, data, nextWaAccountId) {
  const nextMessageSendTtlSeconds =
    data.message_send_ttl_seconds !== undefined
      ? normalizeMessageSendTtl(data.message_send_ttl_seconds)
      : normalizeMessageSendTtl(template.message_send_ttl_seconds);

  return {
    nameChanged: data.name !== undefined && data.name !== template.name,
    languageChanged: data.language !== undefined && data.language !== template.language,
    typeChanged: data.type !== undefined && data.type !== template.type,
    waAccountChanged: data.wa_account_id !== undefined && nextWaAccountId !== template.wa_account_id,
    categoryChanged: data.category !== undefined && data.category !== template.category,
    componentsChanged:
      data.components !== undefined
      && !areJsonValuesEqual(data.components, template.components),
    messageSendTtlChanged: data.message_send_ttl_seconds !== undefined
      && nextMessageSendTtlSeconds !== normalizeMessageSendTtl(template.message_send_ttl_seconds),
  };
}

function assertMetaTemplateUpdateAllowed(template, changes) {
  const disallowedFields = [];

  if (changes.nameChanged) {
    disallowedFields.push('name');
  }

  if (changes.languageChanged) {
    disallowedFields.push('language');
  }

  if (changes.typeChanged) {
    disallowedFields.push('type');
  }

  if (changes.waAccountChanged) {
    disallowedFields.push('wa_account_id');
  }

  if (
    resolveTemplateMetaStatus(template) === 'APPROVED'
    && changes.categoryChanged
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
  record.message_send_ttl_seconds = normalizeMessageSendTtl(record.message_send_ttl_seconds);

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
async function createTemplate(requestContext, data) {
  const userId = resolveScopeId(requestContext);
  // Check subscription limit before creating
  await checkSubscriptionLimit(userId);
  const activeAccount = await requireAutoResolvedWaAccount(
    userId,
    data.wa_account_id,
    'creating a template'
  );
  const resolvedWabaId = String(activeAccount.waba_id);

  const normalizedComponents = normalizeTemplateComponentsForMetaCompatibility(data.components);

  assertTemplateBusinessRules({
    ...data,
    components: normalizedComponents,
    waba_id: resolvedWabaId,
  });

  // Check name uniqueness scoped to user + waba_id
  const whereClause = {
    user_id: userId,
    name: data.name,
    language: data.language || 'en_US',
  };
  whereClause.waba_id = resolvedWabaId;

  const existingTemplate = await Template.findOne({ where: whereClause });
  if (existingTemplate) {
    throw AppError.conflict(
      `A template with the name "${data.name}" and language "${data.language || 'en_US'}" already exists for WABA ${resolvedWabaId}`
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
    components: normalizedComponents,
    example_values: data.example_values || null,
    message_send_ttl_seconds: normalizeMessageSendTtl(data.message_send_ttl_seconds),
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
async function listTemplates(requestContext, filters) {
  const userId = resolveScopeId(requestContext);
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
async function getTemplate(requestContext, templateId) {
  const userId = resolveScopeId(requestContext);
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
async function updateTemplate(requestContext, templateId, data, accessToken = null) {
  const userId = resolveScopeId(requestContext);
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
  const nextLanguage = data.language !== undefined ? data.language : template.language;

  // If the destination name or WABA changes, check uniqueness in the destination scope
  if (nextName !== template.name || nextLanguage !== template.language || nextWabaId !== template.waba_id) {
    const whereClause = {
      user_id: userId,
      name: nextName,
      language: nextLanguage,
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
        `A template with the name "${nextName}" and language "${nextLanguage}" already exists${nextWabaId ? ` for WABA ${nextWabaId}` : ''}`
      );
    }
  }

  const normalizedUpdatedComponents = data.components !== undefined
    ? normalizeTemplateComponentsForMetaCompatibility(data.components)
    : undefined;

  const nextTemplateState = {
    ...template.toJSON(),
    ...data,
    components: normalizedUpdatedComponents !== undefined ? normalizedUpdatedComponents : template.components,
    type: data.type !== undefined ? data.type : template.type,
    category: data.category !== undefined ? data.category : template.category,
    language: data.language !== undefined ? data.language : template.language,
    message_send_ttl_seconds:
      data.message_send_ttl_seconds !== undefined
        ? normalizeMessageSendTtl(data.message_send_ttl_seconds)
        : normalizeMessageSendTtl(template.message_send_ttl_seconds),
    wa_account_id: nextWaAccountId,
    waba_id: nextWabaId,
  };
  assertTemplateBusinessRules(nextTemplateState);

  const localOnlyUpdateFields = {};
  if (data.display_name !== undefined) localOnlyUpdateFields.display_name = data.display_name;
  if (data.example_values !== undefined) localOnlyUpdateFields.example_values = data.example_values;

  const managedChanges = getMetaManagedTemplateChanges(template, data, nextWaAccountId);
  let effectiveMetaStatus = resolveTemplateMetaStatus(template);
  let resolvedMetaTemplateId = trimString(template.meta_template_id) || null;
  let linkedAccountContext = null;

  if (hasMetaManagementHint(template)) {
    const linkage = await reconcileMetaTemplateLinkage(requestContext, template, accessToken, {
      requireAccountContext: false,
      requireRemoteTemplate: false,
    });

    effectiveMetaStatus = linkage.metaStatusRaw || effectiveMetaStatus;
    resolvedMetaTemplateId = linkage.metaTemplateId || resolvedMetaTemplateId;
    linkedAccountContext = linkage.accountContext || null;
  }

  const isMetaLifecycleTemplate = Boolean(resolvedMetaTemplateId || effectiveMetaStatus);
  const hasMetaLinkageGap = Boolean(effectiveMetaStatus && !resolvedMetaTemplateId);
  const isMetaLinkedTemplate = Boolean(resolvedMetaTemplateId && effectiveMetaStatus);

  if (isMetaLifecycleTemplate) {
    assertMetaTemplateUpdateAllowed(template, managedChanges);
  }

  if (
    hasMetaLinkageGap
    && (managedChanges.categoryChanged || managedChanges.componentsChanged || managedChanges.messageSendTtlChanged)
  ) {
    throw AppError.badRequest(
      'This template looks Meta-managed, but its Meta template ID could not be verified. Sync from Meta before editing the live template content.'
    );
  }

  if (isMetaLinkedTemplate) {
    const hasMetaManagedChanges =
      managedChanges.categoryChanged
      || managedChanges.componentsChanged
      || managedChanges.messageSendTtlChanged;

    if (!hasMetaManagedChanges) {
      if (Object.keys(localOnlyUpdateFields).length > 0) {
        await template.update(localOnlyUpdateFields);
      }
      return serializeTemplate(template);
    }

    const accountContext = linkedAccountContext || await resolveAccountContext(userId, {
      waAccountId: template.wa_account_id,
      wabaId: template.waba_id,
      providedAccessToken: accessToken,
      allowFallbackByWaba: true,
    });

    if (!accountContext) {
      throw AppError.badRequest(
        'WhatsApp access token is required for editing a Meta template. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
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
      components: normalizedUpdatedComponents !== undefined ? normalizedUpdatedComponents : template.components,
      message_send_ttl_seconds:
        data.message_send_ttl_seconds !== undefined
          ? normalizeMessageSendTtl(data.message_send_ttl_seconds)
          : normalizeMessageSendTtl(template.message_send_ttl_seconds),
      wa_account_id: accountContext.wa_account_id || template.wa_account_id,
      waba_id: wabaId,
      meta_template_id: resolvedMetaTemplateId,
      meta_status_raw: effectiveMetaStatus || template.meta_status_raw,
    };

    const payload = await buildMetaTemplatePayload(
      requestContext,
      accountContext.access_token,
      metaEditableTemplate,
      wabaId,
      { includeIdentity: false }
    );
    const isAuthenticationMetaTemplate = isAuthenticationTemplate(metaEditableTemplate);
    let authUpsertResult = null;

    try {
      if (isAuthenticationMetaTemplate) {
        const upsertResponse = await submitAuthenticationTemplateUpsert(
          accountContext.access_token,
          wabaId,
          payload,
          metaEditableTemplate.language
        );
        authUpsertResult = upsertResponse.result;
      } else {
        await axios.post(
          `${config.meta.baseUrl}/${resolvedMetaTemplateId}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accountContext.access_token}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          }
        );
      }
    } catch (err) {
      const metaError = err.response?.data?.error;
      throw AppError.badRequest(
        `Meta API error: ${metaError?.message || err.message}`
      );
    }

    const authUpsertMetaTemplateId = extractMetaTemplateIdentifier(authUpsertResult);
    let refreshedTemplate = null;
    try {
      if (isAuthenticationMetaTemplate) {
        refreshedTemplate = await findRemoteMetaTemplate({
          accessToken: accountContext.access_token,
          wabaId,
          metaTemplateId: authUpsertMetaTemplateId || resolvedMetaTemplateId,
          templateName: metaEditableTemplate.name,
          templateLanguage: metaEditableTemplate.language,
        });
      } else {
        refreshedTemplate = await fetchMetaTemplateById(
          resolvedMetaTemplateId,
          accountContext.access_token
        );
      }
    } catch (err) {
      console.warn(
        '[template-service] Could not refresh edited template from Meta:',
        err.response?.data?.error?.message || err.message
      );
    }

    const refreshedMetaTemplateId = trimString(refreshedTemplate?.id) || authUpsertMetaTemplateId || resolvedMetaTemplateId;
    const nextMetaStatus = normalizeMetaTemplateStatus(refreshedTemplate?.status || authUpsertResult?.status)
      || trimString(refreshedTemplate?.status || authUpsertResult?.status).toUpperCase()
      || 'PENDING';

    const updateFields = refreshedTemplate
      ? mapMetaTemplateToLocalState(refreshedTemplate, {
          wabaId,
          waAccountId: accountContext.wa_account_id || template.wa_account_id,
          metaTemplateId: refreshedMetaTemplateId,
        })
      : {
          category: data.category !== undefined ? data.category : template.category,
          components: normalizedUpdatedComponents !== undefined ? normalizedUpdatedComponents : template.components,
          message_send_ttl_seconds:
            data.message_send_ttl_seconds !== undefined
              ? normalizeMessageSendTtl(data.message_send_ttl_seconds)
              : normalizeMessageSendTtl(template.message_send_ttl_seconds),
          status: deriveLocalTemplateStatus(nextMetaStatus, 'pending'),
          meta_template_id: refreshedMetaTemplateId,
          meta_status_raw: nextMetaStatus,
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
  if (normalizedUpdatedComponents !== undefined) updateFields.components = normalizedUpdatedComponents;
  if (data.example_values !== undefined) updateFields.example_values = data.example_values;
  if (data.message_send_ttl_seconds !== undefined) {
    updateFields.message_send_ttl_seconds = normalizeMessageSendTtl(data.message_send_ttl_seconds);
  }
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
function shouldDeleteFromMeta(metaStatus) {
  return !['PENDING_DELETION', 'DELETED'].includes(metaStatus);
}

async function deleteTemplateFromMeta(accountContext, template, remoteTemplate = null) {
  const wabaId = String(accountContext.waba_id);
  const remoteTemplateId = trimString(remoteTemplate?.id) || trimString(template.meta_template_id) || null;
  const remoteTemplateName = trimString(remoteTemplate?.name) || trimString(template.name);
  const remoteTemplateLanguage = trimString(remoteTemplate?.language) || trimString(template.language);

  try {
    await axios.delete(
      `${config.meta.baseUrl}/${wabaId}/message_templates`,
      {
        params: pickDefinedEntries([
          ['name', remoteTemplateName],
          ['hsm_id', remoteTemplateId || undefined],
        ]),
        headers: {
          Authorization: `Bearer ${accountContext.access_token}`,
        },
        timeout: 10000,
      }
    );
  } catch (err) {
    const metaError = err.response?.data?.error;
    if (!metaError || Number(metaError.code) !== 100) {
      throw AppError.badRequest(
        `Failed to delete template from Meta: ${metaError?.message || err.message}`
      );
    }

    const refreshedRemoteTemplate = await findRemoteMetaTemplate({
      accessToken: accountContext.access_token,
      wabaId,
      metaTemplateId: remoteTemplateId,
      templateName: remoteTemplateName,
      templateLanguage: remoteTemplateLanguage,
    });
    const refreshedRemoteStatus = normalizeMetaTemplateStatus(refreshedRemoteTemplate?.status)
      || trimString(refreshedRemoteTemplate?.status).toUpperCase()
      || null;

    if (refreshedRemoteTemplate && shouldDeleteFromMeta(refreshedRemoteStatus)) {
      throw AppError.badRequest(
        `Failed to delete template from Meta: ${metaError.message || err.message}`
      );
    }

    console.warn(
      '[template-service] Meta template deletion warning:',
      metaError?.message || err.message
    );
  }
}

async function deleteTemplate(requestContext, templateId, accessToken) {
  const userId = resolveScopeId(requestContext);
  const template = await Template.findOne({
    where: { id: templateId, user_id: userId },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  if (!canDeleteTemplate(template)) {
    throw AppError.badRequest('This Meta template is in an unsupported lifecycle state for deletion. Sync from Meta before trying again.');
  }

  const metaStatusRaw = resolveTemplateMetaStatus(template);

  if (hasMetaManagementHint(template)) {
    const linkage = await reconcileMetaTemplateLinkage(requestContext, template, accessToken, {
      requireAccountContext: true,
      requireRemoteTemplate: false,
    });
    const remoteTemplate = linkage.remoteTemplate;
    const remoteMetaStatus = linkage.metaStatusRaw || metaStatusRaw;

    if (remoteTemplate && shouldDeleteFromMeta(remoteMetaStatus)) {
      await deleteTemplateFromMeta(linkage.accountContext, template, remoteTemplate);
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
async function publishTemplate(requestContext, templateId, accessToken, waAccountIdOverride) {
  const userId = resolveScopeId(requestContext);
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

  const normalizedTemplateComponents = normalizeTemplateComponentsForMetaCompatibility(template.toJSON().components);

  assertTemplateBusinessRules({
    ...template.toJSON(),
    components: normalizedTemplateComponents,
    wa_account_id: accountContext.wa_account_id,
    waba_id: wabaId,
  });

  const normalizedTemplate = {
    ...template.toJSON(),
    components: normalizedTemplateComponents,
  };

  // Build Meta API payload
  const payload = await buildMetaTemplatePayload(
    requestContext,
    accountContext.access_token,
    normalizedTemplate,
    wabaId
  );

  const isAuthenticationPublish = isAuthenticationTemplate(normalizedTemplate);
  const publishPath = isAuthenticationPublish
    ? `${config.meta.baseUrl}/${wabaId}/upsert_message_templates`
    : normalizeMessageSendTtl(template.message_send_ttl_seconds)
      ? accountContext.account?.phone_number_id
        ? `${config.meta.baseUrl}/${accountContext.account.phone_number_id}/message_templates`
        : null
      : `${config.meta.baseUrl}/${wabaId}/message_templates`;

  if (!isAuthenticationPublish && normalizeMessageSendTtl(template.message_send_ttl_seconds) && !publishPath) {
    throw AppError.badRequest(
      'Select an active WhatsApp phone number before publishing a template with a custom delivery TTL.'
    );
  }

  let metaResponseData;
  let authUpsertResult = null;
  try {
    if (isAuthenticationPublish) {
      const upsertResponse = await submitAuthenticationTemplateUpsert(
        accountContext.access_token,
        wabaId,
        payload,
        normalizedTemplate.language
      );
      metaResponseData = upsertResponse.responseData;
      authUpsertResult = upsertResponse.result;
    } else {
      const metaResponse = await axios.post(
        publishPath,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accountContext.access_token}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      metaResponseData = metaResponse.data;
    }
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

  const authUpsertMetaTemplateId = extractMetaTemplateIdentifier(authUpsertResult);
  const publishedRemoteTemplate = isAuthenticationPublish
    ? await findRemoteMetaTemplate({
        accessToken: accountContext.access_token,
        wabaId,
        metaTemplateId: authUpsertMetaTemplateId || null,
        templateName: template.name,
        templateLanguage: template.language,
      })
    : metaResponseData?.id
      ? metaResponseData
      : await findRemoteMetaTemplate({
          accessToken: accountContext.access_token,
          wabaId,
          templateName: template.name,
          templateLanguage: template.language,
        });

  // Extract template ID from Meta response
  const metaTemplateId = trimString(publishedRemoteTemplate?.id) || authUpsertMetaTemplateId || trimString(metaResponseData?.id) || null;
  const metaStatus = normalizeMetaTemplateStatus(publishedRemoteTemplate?.status || authUpsertResult?.status || metaResponseData?.status)
    || trimString(publishedRemoteTemplate?.status || authUpsertResult?.status || metaResponseData?.status).toUpperCase()
    || 'PENDING';
  const nextStatus = deriveLocalTemplateStatus(metaStatus, 'pending');
  const rejectionReason = metaStatus === 'REJECTED'
    ? extractRejectionReason(publishedRemoteTemplate || authUpsertResult || metaResponseData)
    : null;
  // Update local template record
  const updateData = {
    status: nextStatus,
    meta_template_id: metaTemplateId,
    meta_status_raw: metaStatus,
    quality_score: null,
    quality_reasons: null,
    rejection_reason: rejectionReason,
    message_send_ttl_seconds: normalizeMessageSendTtl(template.message_send_ttl_seconds),
    waba_id: wabaId,
    wa_account_id: accountContext.wa_account_id || template.wa_account_id,
    last_synced_at: new Date(),
    components: normalizedTemplateComponents,
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
async function syncTemplates(requestContext, waAccountId, accessToken) {
  const userId = resolveScopeId(requestContext);
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
  const metaTemplates = await listMetaTemplatesForWaba(wabaId, accountContext.access_token);

  let created = 0;
  let updated = 0;

  for (const metaTemplate of metaTemplates) {
    const metaId = metaTemplate.id;
    const metaName = metaTemplate.name;
    const metaLanguage = metaTemplate.language || null;
    const localTemplate = await findTemplateByMetaIdentifiers({
      userId,
      metaTemplateId: metaId,
      templateName: metaName,
      templateLanguage: metaLanguage,
      wabaId,
    });

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
        message_send_ttl_seconds: syncedState.message_send_ttl_seconds,
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
