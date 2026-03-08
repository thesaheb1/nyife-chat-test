'use strict';

const { Op, QueryTypes } = require('sequelize');
const axios = require('axios');
const { Template, Flow, sequelize } = require('../models');
const { AppError, decrypt, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');
const { assertTemplateBusinessRules, getTemplateAvailableActions } = require('../helpers/templateRules');
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
    console.warn('[template-service] Failed to load stored WhatsApp account token:', err.message);
    return null;
  }

  if (!accounts || accounts.length === 0 || !accounts[0].access_token) {
    return null;
  }

  try {
    return decrypt(accounts[0].access_token);
  } catch (err) {
    console.warn('[template-service] Failed to decrypt stored WhatsApp access token:', err.message);
    return null;
  }
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

function serializeTemplate(template) {
  const record = typeof template.toJSON === 'function' ? template.toJSON() : { ...template };
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
  assertTemplateBusinessRules(data);

  // Check name uniqueness scoped to user + waba_id
  const whereClause = {
    user_id: userId,
    name: data.name,
  };
  if (data.waba_id) {
    whereClause.waba_id = data.waba_id;
  } else {
    whereClause.waba_id = { [Op.is]: null };
  }

  const existingTemplate = await Template.findOne({ where: whereClause });
  if (existingTemplate) {
    throw AppError.conflict(
      `A template with the name "${data.name}" already exists${data.waba_id ? ` for WABA ${data.waba_id}` : ''}`
    );
  }

  const template = await Template.create({
    user_id: userId,
    waba_id: data.waba_id || null,
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
  const { page, limit, status, category, type, search, waba_id } = filters;
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
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { display_name: { [Op.like]: `%${search}%` } },
    ];
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
 * Updates a template. Only allows updates to templates in 'draft' or 'rejected' status.
 * If the template has been published (has meta_template_id), only components can be updated
 * via Meta's edit API, handled separately.
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

  // Only allow editing draft or rejected templates locally
  if (!['draft', 'rejected'].includes(template.status)) {
    throw AppError.badRequest(
      `Cannot edit a template with status "${template.status}". Only draft or rejected templates can be edited.`
    );
  }

  const nextName = data.name !== undefined ? data.name : template.name;
  const nextWabaId = data.waba_id !== undefined ? data.waba_id : template.waba_id;

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
    waba_id: data.waba_id !== undefined ? data.waba_id : template.waba_id,
  };
  assertTemplateBusinessRules(nextTemplateState);

  // Build the update object only with provided fields
  const updateFields = {};
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.display_name !== undefined) updateFields.display_name = data.display_name;
  if (data.language !== undefined) updateFields.language = data.language;
  if (data.category !== undefined) updateFields.category = data.category;
  if (data.type !== undefined) updateFields.type = data.type;
  if (data.components !== undefined) updateFields.components = data.components;
  if (data.example_values !== undefined) updateFields.example_values = data.example_values;
  if (data.waba_id !== undefined) updateFields.waba_id = data.waba_id;

  // If the template was rejected and is being re-edited, reset status to draft
  if (template.status === 'rejected') {
    updateFields.status = 'draft';
    updateFields.rejection_reason = null;
    updateFields.meta_template_id = null;
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

  // If the template has been published to Meta, delete from Meta first
  if (template.meta_template_id && template.waba_id) {
    const resolvedAccessToken = await resolveAccessToken(userId, template.waba_id, accessToken);

    if (!resolvedAccessToken) {
      throw AppError.badRequest(
        'WhatsApp access token is required to delete a published template. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
      );
    }

    try {
      await axios.delete(
        `${config.meta.baseUrl}/${template.waba_id}/message_templates`,
        {
          params: pickDefinedEntries([
            ['name', template.name],
            ['hsm_id', template.meta_template_id],
          ]),
          headers: {
            Authorization: `Bearer ${resolvedAccessToken}`,
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
 * @param {string|null} wabaIdOverride - Optional WABA ID override from request body
 * @returns {Promise<object>} The updated template with meta_template_id
 */
async function publishTemplate(userId, templateId, accessToken, wabaIdOverride) {
  const template = await Template.findOne({
    where: { id: templateId, user_id: userId },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  // Only draft or rejected templates can be published
  if (!['draft', 'rejected'].includes(template.status)) {
    throw AppError.badRequest(
      `Cannot publish a template with status "${template.status}". Only draft or rejected templates can be published.`
    );
  }

  // Determine the WABA ID to use
  const wabaId = wabaIdOverride || template.waba_id;
  if (!wabaId) {
    throw AppError.badRequest(
      'WABA ID is required for publishing. Set it on the template or provide it in the request body.'
    );
  }

  const resolvedAccessToken = await resolveAccessToken(userId, wabaId, accessToken);

  if (!resolvedAccessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for publishing. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
    );
  }

  assertTemplateBusinessRules({
    ...template.toJSON(),
    waba_id: wabaId,
  });

  // Build Meta API payload
  const payload = await buildMetaTemplatePayload(
    userId,
    resolvedAccessToken,
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
          Authorization: `Bearer ${resolvedAccessToken}`,
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
  const metaStatus = metaResponse.data?.status;

  // Update local template record
  const updateData = {
    status: 'pending',
    meta_template_id: metaTemplateId || null,
    waba_id: wabaId,
    last_synced_at: new Date(),
  };

  // If Meta immediately approved/rejected (rare but possible)
  if (metaStatus === 'APPROVED') {
    updateData.status = 'approved';
  } else if (metaStatus === 'REJECTED') {
    updateData.status = 'rejected';
    updateData.rejection_reason = metaResponse.data?.rejection_reason || null;
  }

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
 * @param {string} wabaId - WhatsApp Business Account ID
 * @param {string} accessToken - Meta WhatsApp access token
 * @returns {Promise<{ synced: number, created: number, updated: number }>}
 */
async function syncTemplates(userId, wabaId, accessToken) {
  const resolvedAccessToken = await resolveAccessToken(userId, wabaId, accessToken);

  if (!resolvedAccessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for syncing. Configure META_SYSTEM_USER_ACCESS_TOKEN, connect an active WhatsApp account for this WABA, or provide x-wa-access-token.'
    );
  }

  if (!wabaId) {
    throw AppError.badRequest('WABA ID is required for syncing templates.');
  }

  // Fetch all templates from Meta
  let metaTemplates = [];
  let nextUrl = `${config.meta.baseUrl}/${wabaId}/message_templates?limit=100`;

  try {
    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        headers: {
          Authorization: `Bearer ${resolvedAccessToken}`,
        },
        timeout: 15000,
      });

      if (response.data?.data) {
        metaTemplates = metaTemplates.concat(response.data.data);
      }

      // Handle pagination from Meta API
      nextUrl = response.data?.paging?.next || null;
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

  // Map Meta status to our local status
  const statusMap = {
    APPROVED: 'approved',
    PENDING: 'pending',
    REJECTED: 'rejected',
    PAUSED: 'paused',
    DISABLED: 'disabled',
  };

  for (const metaTemplate of metaTemplates) {
    const metaId = metaTemplate.id;
    const metaName = metaTemplate.name;
    const metaStatus = statusMap[metaTemplate.status] || 'pending';
    const metaCategory = metaTemplate.category;
    const metaLanguage = metaTemplate.language;
    const metaComponents = metaTemplate.components || [];
    const rejectionReason = metaTemplate.rejected_reason || metaTemplate.quality_score?.reasons?.join(', ') || null;

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
      // Update existing template with Meta's current state
      const updateData = {
        status: metaStatus,
        meta_template_id: metaId,
        components: metaComponents,
        category: metaCategory,
        language: metaLanguage,
        type: detectTemplateType(metaComponents),
        rejection_reason: rejectionReason,
        last_synced_at: new Date(),
      };

      if (!localTemplate.source && !localTemplate.meta_template_id) {
        updateData.source = 'meta_sync';
      }

      await localTemplate.update(updateData);
      updated++;
    } else {
      // Create new local record for template that exists on Meta but not locally
      await Template.create({
        user_id: userId,
        waba_id: wabaId,
        name: metaName,
        display_name: metaName.replace(/_/g, ' '),
        language: metaLanguage,
        category: metaCategory,
        type: detectTemplateType(metaComponents),
        status: metaStatus,
        source: 'meta_sync',
        components: metaComponents,
        meta_template_id: metaId,
        rejection_reason: rejectionReason,
        last_synced_at: new Date(),
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
  resolveAccessToken,
};
