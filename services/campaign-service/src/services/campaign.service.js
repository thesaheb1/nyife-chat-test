'use strict';

const { Op, QueryTypes } = require('sequelize');
const axios = require('axios');
const { Campaign, CampaignMessage, sequelize } = require('../models');
const { AppError, getPagination, getPaginationMeta, generateUUID } = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const { resolveVariables, buildTemplateComponents } = require('../helpers/variableResolver');
const {
  buildLegacyVariablesMapping,
  buildPersistedTemplateBindings,
  extractTemplateBindingRequirements,
  normalizeStoredTemplateBindings,
  pruneTemplateBindings,
  templateRequiresCatalogSupport,
  validateTemplateBindings,
} = require('../helpers/templateBindings');
const { buildInternalOrganizationHeaders, resolveScopeId } = require('../helpers/requestContext');
const config = require('../config');

const CONTACT_SERVICE_PAGE_LIMIT = 100;
const CONTACT_IDS_BATCH_SIZE = 100;
const TAG_IDS_BATCH_SIZE = 100;

// ────────────────────────────────────────────────
// Helper: Inter-service HTTP calls
// ────────────────────────────────────────────────

/**
 * Checks subscription limit for a given resource.
 * @param {string} userId
 * @param {string} resource - e.g., 'campaigns'
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
async function checkSubscriptionLimit(userId, resource) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/check-limit/${userId}/${resource}`,
      { timeout: 5000 }
    );
    return response.data.data;
  } catch (err) {
    if (err.response && err.response.status === 403) {
      throw AppError.forbidden('Subscription limit reached for ' + resource);
    }
    console.error('[campaign-service] Failed to check subscription limit:', err.message);
    // In development, allow if subscription service is unavailable
    if (config.nodeEnv === 'development') {
      return { allowed: true, remaining: 999 };
    }
    throw AppError.internal('Unable to verify subscription limits');
  }
}

/**
 * Increments subscription usage for a given resource.
 * @param {string} userId
 * @param {string} resource
 * @param {number} count
 */
async function incrementSubscriptionUsage(userId, resource, count = 1) {
  try {
    await axios.post(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/increment-usage/${userId}`,
      { resource, count },
      { timeout: 5000 }
    );
  } catch (err) {
    console.error('[campaign-service] Failed to increment subscription usage:', err.message);
    // Non-blocking in development
    if (config.nodeEnv !== 'development') {
      throw AppError.internal('Unable to update subscription usage');
    }
  }
}

/**
 * Fetches template details from template-service.
 * @param {object|string} requestContext
 * @param {string} templateId
 * @returns {Promise<object>} Template data
 */
async function fetchTemplate(requestContext, templateId) {
  try {
    const response = await axios.get(
      `${config.templateServiceUrl}/api/v1/templates/${templateId}`,
      {
        headers: buildInternalOrganizationHeaders(requestContext),
        timeout: 5000,
      }
    );
    return response.data.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw AppError.notFound('Template not found');
    }
    console.error('[campaign-service] Failed to fetch template:', {
      status: err.response?.status || null,
      message: err.message,
      data: err.response?.data || null,
    });
    throw AppError.internal('Unable to fetch template details');
  }
}

function buildCampaignMediaPreviewUrl(fileId) {
  return fileId ? `/api/v1/media/${encodeURIComponent(fileId)}/download` : undefined;
}

async function fetchMediaFile(requestContext, fileId) {
  try {
    const response = await axios.get(
      `${config.mediaServiceUrl}/api/v1/media/${fileId}`,
      {
        headers: buildInternalOrganizationHeaders(requestContext),
        timeout: 10000,
      }
    );

    return response.data?.data || null;
  } catch (err) {
    if (err.response?.status === 404) {
      throw AppError.badRequest('One of the selected campaign media files no longer exists.');
    }

    console.error('[campaign-service] Failed to fetch media file:', {
      fileId,
      status: err.response?.status || null,
      message: err.message,
      data: err.response?.data || null,
    });
    throw AppError.internal('Unable to validate campaign media files');
  }
}

async function canonicalizeTemplateMediaBindings(requestContext, mediaRequirements, mediaBindings) {
  const requirementByKey = new Map((mediaRequirements || []).map((field) => [field.key, field]));
  const normalizedBindings =
    mediaBindings && typeof mediaBindings === 'object' && !Array.isArray(mediaBindings)
      ? mediaBindings
      : {};
  const uniqueFileIds = [...new Set(
    Object.values(normalizedBindings)
      .map((binding) => (binding && typeof binding === 'object' ? String(binding.file_id || '').trim() : ''))
      .filter(Boolean)
  )];

  const fileRecords = new Map();
  await Promise.all(
    uniqueFileIds.map(async (fileId) => {
      const file = await fetchMediaFile(requestContext, fileId);
      if (file) {
        fileRecords.set(String(file.id), file);
      }
    })
  );

  const canonicalized = {};

  for (const [key, binding] of Object.entries(normalizedBindings)) {
    const requirement = requirementByKey.get(key);
    if (!requirement) {
      continue;
    }

    const fileId = String(binding?.file_id || '').trim();
    if (!fileId) {
      continue;
    }

    const file = fileRecords.get(fileId);
    if (!file) {
      throw AppError.badRequest(`The selected file for ${requirement.label.toLowerCase()} is no longer available.`);
    }

    const actualType = String(file.type || '').trim().toLowerCase();
    if (actualType !== requirement.media_type) {
      throw AppError.badRequest(
        `${requirement.label} expects a ${requirement.media_type} file, but the selected file is ${actualType || 'invalid'}.`
      );
    }

    canonicalized[key] = {
      file_id: file.id,
      media_type: actualType,
      original_name: file.original_name,
      mime_type: file.mime_type,
      size: Number(file.size || 0),
      ...(buildCampaignMediaPreviewUrl(file.id) ? { preview_url: buildCampaignMediaPreviewUrl(file.id) } : {}),
    };
  }

  return canonicalized;
}

async function normalizeCampaignTemplateBindings(requestContext, template, templateBindings, legacyVariablesMapping = null) {
  const requirements = extractTemplateBindingRequirements(template);
  const normalizedBindings = normalizeStoredTemplateBindings(templateBindings, legacyVariablesMapping);
  const prunedBindings = pruneTemplateBindings(normalizedBindings, requirements);
  const canonicalMedia = await canonicalizeTemplateMediaBindings(
    requestContext,
    requirements.media,
    prunedBindings.media
  );
  const mergedBindings = {
    variables: prunedBindings.variables,
    media: canonicalMedia,
    locations: prunedBindings.locations,
    products: prunedBindings.products,
  };
  const validation = validateTemplateBindings(requirements, mergedBindings);

  if (!validation.isComplete) {
    throw AppError.badRequest(
      'Complete all required template inputs before saving or sending this campaign.',
      validation.issues
    );
  }

  return {
    requirements,
    templateBindings: buildPersistedTemplateBindings(mergedBindings),
    legacyVariablesMapping: buildLegacyVariablesMapping(mergedBindings, legacyVariablesMapping),
  };
}

async function resolveCampaignProductCatalogSupport(requestContext, waAccountId) {
  try {
    const response = await axios.post(
      `${config.whatsappServiceUrl}/api/v1/whatsapp/internal/account-product-catalogs`,
      {
        wa_account_id: waAccountId,
      },
      {
        headers: {
          ...buildInternalOrganizationHeaders(requestContext),
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data?.data?.product_catalogs || {
      linked: false,
      count: 0,
      items: [],
    };
  } catch (err) {
    console.error('[campaign-service] Failed to resolve campaign product catalog support:', {
      status: err.response?.status || null,
      message: err.message,
      data: err.response?.data || null,
    });

    const responseMessage =
      err.response?.data?.message
      || err.response?.data?.error
      || err.message
      || 'Unable to verify Meta product catalog support for this campaign.';

    throw AppError.badRequest(responseMessage);
  }
}

async function assertTemplateAccountCapabilities(requestContext, waAccountId, template, requirements = null) {
  const needsCatalogSupport =
    Boolean(requirements?.requires_catalog_support)
    || templateRequiresCatalogSupport(template);

  if (!needsCatalogSupport) {
    return null;
  }

  const productCatalogs = await resolveCampaignProductCatalogSupport(requestContext, waAccountId);
  if ((productCatalogs?.count || 0) > 0) {
    return productCatalogs;
  }

  throw AppError.badRequest(
    'This template requires a Meta product catalog linked to the selected WhatsApp account. Link a catalog in Meta before creating or starting this campaign.'
  );
}

async function resolveCampaignMediaBindings(requestContext, waAccountId, mediaBindings) {
  const normalizedBindings =
    mediaBindings && typeof mediaBindings === 'object' && !Array.isArray(mediaBindings)
      ? mediaBindings
      : {};

  if (!Object.keys(normalizedBindings).length) {
    return {};
  }

  try {
    const response = await axios.post(
      `${config.whatsappServiceUrl}/api/v1/whatsapp/internal/campaign-media/resolve`,
      {
        wa_account_id: waAccountId,
        media_bindings: normalizedBindings,
      },
      {
        headers: {
          ...buildInternalOrganizationHeaders(requestContext),
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    return response.data?.data?.media || {};
  } catch (err) {
    console.error('[campaign-service] Failed to resolve campaign media bindings:', {
      status: err.response?.status || null,
      message: err.message,
      data: err.response?.data || null,
    });

    const responseMessage =
      err.response?.data?.message
      || err.response?.data?.error
      || err.message
      || 'Unable to prepare template media for this campaign.';
    throw AppError.badRequest(
      responseMessage
    );
  }
}

async function findActiveWaAccount(userId, waAccountId) {
  const accounts = await sequelize.query(
    `SELECT id, user_id, waba_id, status, onboarding_status
     FROM wa_accounts
     WHERE id = :waAccountId
       AND user_id = :userId
       AND status = :status
       AND deleted_at IS NULL
     LIMIT 1`,
    {
      replacements: {
        waAccountId,
        userId,
        status: 'active',
      },
      type: QueryTypes.SELECT,
    }
  );

  const account = accounts[0] || null;
  if (!account) {
    return null;
  }

  return account;
}

function assertTemplateMatchesWaAccount(template, account) {
  if (!template?.waba_id) {
    return;
  }

  if (String(template.waba_id) !== String(account.waba_id)) {
    throw AppError.badRequest(
      `Template belongs to WABA ${template.waba_id}, but the selected WhatsApp account belongs to WABA ${account.waba_id}.`
    );
  }
}

function isTemplateApproved(template) {
  const status = String(template?.status || '').trim().toLowerCase();
  return status === 'approved';
}

function assertTemplateEligibleForCampaign(template) {
  if (!isTemplateApproved(template)) {
    throw AppError.badRequest(`Template is not approved. Current status: ${template?.status || 'unknown'}`);
  }

  if (!template?.meta_template_id) {
    throw AppError.badRequest('Template must be published to Meta before it can be used in a campaign.');
  }
}

/**
 * Checks wallet balance for a user.
 * @param {string} userId
 * @returns {Promise<{balance: number}>}
 */
async function checkWalletBalance(userId) {
  try {
    const response = await axios.get(
      `${config.walletServiceUrl}/api/v1/wallet/balance/${userId}`,
      { timeout: 5000 }
    );
    return response.data.data;
  } catch (err) {
    console.error('[campaign-service] Failed to check wallet balance:', err.message);
    if (config.nodeEnv === 'development') {
      return { balance: 999999 };
    }
    throw AppError.internal('Unable to verify wallet balance');
  }
}

async function fetchActiveSubscription(userId) {
  try {
    const response = await axios.get(
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/internal/active/${userId}`,
      { timeout: 5000 }
    );
    return response.data?.data?.subscription || null;
  } catch (err) {
    console.error('[campaign-service] Failed to load active subscription:', err.message);
    if (config.nodeEnv === 'development') {
      return {
        plan: {
          max_messages_per_month: 0,
          marketing_message_price: 0,
          utility_message_price: 0,
          auth_message_price: 0,
        },
        usage: {
          messages_this_month: 0,
        },
      };
    }
    throw AppError.internal('Unable to load subscription details');
  }
}

function normalizeBillingCategory(category, fallbackCategory = null) {
  if (!category && fallbackCategory) {
    return normalizeBillingCategory(fallbackCategory);
  }

  const normalized = String(category || '').trim().toLowerCase();
  switch (normalized) {
    case 'marketing':
      return 'marketing';
    case 'utility':
      return 'utility';
    case 'authentication':
    case 'auth':
      return 'authentication';
    case 'service':
    case 'user_initiated':
      return 'service';
    case 'referral_conversion':
    case 'referral':
      return 'referral_conversion';
    default:
      return fallbackCategory ? normalizeBillingCategory(fallbackCategory) : null;
  }
}

function getPlanPriceForCategory(plan, category) {
  const normalizedCategory = normalizeBillingCategory(category);
  if (!plan || !normalizedCategory) {
    return 0;
  }

  switch (normalizedCategory) {
    case 'marketing':
      return Number(plan.marketing_message_price || 0);
    case 'utility':
      return Number(plan.utility_message_price || 0);
    case 'authentication':
      return Number(plan.auth_message_price || 0);
    default:
      return 0;
  }
}

function getMessageLimitState(subscription) {
  const limit = Number(subscription?.plan?.max_messages_per_month || 0);
  const used = Number(subscription?.usage?.messages_this_month || 0);
  if (!subscription) {
    return { limit: 0, used: 0, remaining: 0, allowed: false };
  }
  if (limit === 0) {
    return { limit: Infinity, used, remaining: Infinity, allowed: true };
  }

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    allowed: used < limit,
  };
}

async function estimateCampaignRecipients(requestContext, targetType, targetConfig) {
  const contacts = await resolveContacts(requestContext, targetType, targetConfig);
  return contacts.length;
}

async function getCampaignExecutionPricing(userId, recipientCount, templateCategory) {
  const subscription = await fetchActiveSubscription(userId);
  if (!subscription?.plan) {
    throw AppError.forbidden('An active subscription is required to run WhatsApp campaigns.');
  }

  const messageLimit = getMessageLimitState(subscription);
  if (!messageLimit.allowed || messageLimit.remaining < recipientCount) {
    const remaining = Number.isFinite(messageLimit.remaining) ? messageLimit.remaining : 'unlimited';
    throw AppError.forbidden(
      `Monthly message limit reached. Remaining sends available: ${remaining}.`
    );
  }

  const unitPrice = getPlanPriceForCategory(subscription.plan, templateCategory);
  return {
    unitPrice,
    estimatedCost: recipientCount * unitPrice,
  };
}

async function assertCampaignExecutionAffordable(userId, recipientCount, templateCategory) {
  const pricing = await getCampaignExecutionPricing(userId, recipientCount, templateCategory);
  const walletData = await checkWalletBalance(userId);

  if (walletData.balance < pricing.estimatedCost) {
    throw AppError.badRequest(
      `Insufficient wallet balance. Required: ${pricing.estimatedCost} paise, Available: ${walletData.balance} paise`
    );
  }

  return pricing;
}

function normalizeIdArray(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function splitIntoBatches(values, batchSize) {
  const batches = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }

  return batches;
}

function assertTargetSelection(targetType, targetConfig = {}) {
  const contactIds = normalizeIdArray(targetConfig.contact_ids);
  const groupIds = normalizeIdArray(targetConfig.group_ids);
  const tagIds = normalizeIdArray(targetConfig.tag_ids);

  switch (targetType) {
    case 'contacts':
      if (contactIds.length === 0) {
        throw AppError.badRequest('Select at least one contact for this campaign.');
      }
      break;
    case 'group':
      if (groupIds.length === 0) {
        throw AppError.badRequest('Select at least one contact group for this campaign.');
      }
      break;
    case 'tags':
      if (tagIds.length === 0) {
        throw AppError.badRequest('Select at least one contact tag for this campaign.');
      }
      break;
    case 'all':
      break;
    default:
      throw AppError.badRequest(`Invalid target type: ${targetType}`);
  }
}

async function fetchContactsPage(requestContext, params) {
  const response = await axios.get(`${config.contactServiceUrl}/api/v1/contacts`, {
    params,
    headers: buildInternalOrganizationHeaders(requestContext),
    timeout: 15000,
  });

  return {
    contacts: response.data.data?.contacts || response.data.data || [],
    meta: response.data.meta || null,
  };
}

async function fetchAllContactsByQuery(requestContext, params = {}) {
  const contacts = [];
  let page = 1;

  while (true) {
    const { contacts: pageContacts, meta } = await fetchContactsPage(requestContext, {
      ...params,
      page,
      limit: CONTACT_SERVICE_PAGE_LIMIT,
    });

    contacts.push(...pageContacts);

    const totalPages = Number(meta?.totalPages || 0);
    if (!totalPages || page >= totalPages) {
      break;
    }

    page += 1;
  }

  return contacts;
}

async function fetchContactsByIds(requestContext, ids) {
  const contacts = [];
  const batches = splitIntoBatches(normalizeIdArray(ids), CONTACT_IDS_BATCH_SIZE);

  for (const batch of batches) {
    contacts.push(
      ...(await fetchAllContactsByQuery(requestContext, {
        ids: batch.join(','),
      }))
    );
  }

  return contacts;
}

async function fetchContactsByGroupIds(requestContext, groupIds) {
  const contacts = [];

  for (const groupId of normalizeIdArray(groupIds)) {
    contacts.push(
      ...(await fetchAllContactsByQuery(requestContext, {
        group_id: groupId,
      }))
    );
  }

  return contacts;
}

async function fetchContactsByTagIds(requestContext, tagIds) {
  const contacts = [];
  const batches = splitIntoBatches(normalizeIdArray(tagIds), TAG_IDS_BATCH_SIZE);

  for (const batch of batches) {
    contacts.push(
      ...(await fetchAllContactsByQuery(requestContext, {
        tag_ids: batch.join(','),
      }))
    );
  }

  return contacts;
}

/**
 * Resolves contacts from contact-service based on target type and config.
 * @param {string} userId
 * @param {string} targetType
 * @param {object} targetConfig
 * @returns {Promise<Array>} Array of contact objects
 */
async function resolveContacts(requestContext, targetType, targetConfig) {
  assertTargetSelection(targetType, targetConfig);
  let contacts = [];

  try {
    switch (targetType) {
      case 'contacts': {
        contacts = await fetchContactsByIds(requestContext, targetConfig.contact_ids);
        break;
      }

      case 'group': {
        contacts = await fetchContactsByGroupIds(requestContext, targetConfig.group_ids);
        break;
      }

      case 'tags': {
        contacts = await fetchContactsByTagIds(requestContext, targetConfig.tag_ids);
        break;
      }

      case 'all': {
        contacts = await fetchAllContactsByQuery(requestContext);
        break;
      }

      default:
        throw AppError.badRequest(`Invalid target type: ${targetType}`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('[campaign-service] Failed to resolve contacts:', err.message);
    throw AppError.internal('Unable to resolve target contacts');
  }

  // Deduplicate contacts by id
  const seen = new Set();
  contacts = contacts.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Apply exclude_tag_ids filter if present
  const excludeTagIds = targetConfig.exclude_tag_ids || [];
  if (excludeTagIds.length > 0) {
    contacts = contacts.filter((contact) => {
      const contactTags = contact.tags || contact.tag_ids || [];
      const tagValues = contactTags.map((t) => (typeof t === 'object' ? t.id : t));
      return !tagValues.some((tagId) => excludeTagIds.includes(tagId));
    });
  }

  const excludeContactIds = normalizeIdArray(targetConfig.exclude_contact_ids);
  if (excludeContactIds.length > 0) {
    const excluded = new Set(excludeContactIds);
    contacts = contacts.filter((contact) => !excluded.has(String(contact.id)));
  }

  return contacts;
}

// ────────────────────────────────────────────────
// Service Functions
// ────────────────────────────────────────────────

/**
 * Creates a new campaign in draft status.
 * Validates subscription limit, template existence, and calculates estimated cost.
 */
async function createCampaign(requestContext, data) {
  const userId = resolveScopeId(requestContext);
  // 1. Check subscription limit for campaigns
  const limitCheck = await checkSubscriptionLimit(userId, 'campaigns');
  if (!limitCheck.allowed) {
    throw AppError.forbidden(
      `Campaign limit reached. You have ${limitCheck.remaining} campaigns remaining this month.`
    );
  }

  // 2. Validate template exists, is published, and is approved
  const templateData = await fetchTemplate(requestContext, data.template_id);
  const template = templateData.template || templateData;
  assertTemplateEligibleForCampaign(template);

  const account = await findActiveWaAccount(userId, data.wa_account_id);
  if (!account) {
    throw AppError.badRequest('Select an active WhatsApp account before creating a campaign.');
  }
  assertTemplateMatchesWaAccount(template, account);
  await assertTemplateAccountCapabilities(requestContext, data.wa_account_id, template);
  const normalizedBindings = await normalizeCampaignTemplateBindings(
    requestContext,
    template,
    data.template_bindings,
    data.variables_mapping
  );

  // 3. Estimate recipient count based on target_type
  const estimatedRecipients = await estimateCampaignRecipients(
    requestContext,
    data.target_type,
    data.target_config
  );
  const { estimatedCost } = await getCampaignExecutionPricing(
    userId,
    estimatedRecipients,
    template.category
  );

  // 5. Create campaign record
  const campaign = await Campaign.create({
    id: generateUUID(),
    user_id: userId,
    wa_account_id: data.wa_account_id,
    name: data.name,
    description: data.description || null,
    template_id: data.template_id,
    status: 'draft',
    type: data.type || 'immediate',
    target_type: data.target_type,
    target_config: data.target_config,
    variables_mapping: normalizedBindings.legacyVariablesMapping,
    template_bindings: normalizedBindings.templateBindings,
    scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
    estimated_cost: estimatedCost,
  });

  // 6. Increment subscription usage
  await incrementSubscriptionUsage(userId, 'campaigns', 1);

  return campaign;
}

/**
 * Lists campaigns for a user with pagination, search, status, and date filters.
 */
async function listCampaigns(requestContext, filters) {
  const userId = resolveScopeId(requestContext);
  const { page, limit, status, search, date_from, date_to } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = { user_id: userId };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) {
      where.created_at[Op.gte] = new Date(date_from);
    }
    if (date_to) {
      where.created_at[Op.lte] = new Date(date_to);
    }
  }

  const { rows: campaigns, count: total } = await Campaign.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { campaigns, meta };
}

/**
 * Gets a single campaign by ID with aggregate stats.
 */
async function getCampaign(requestContext, campaignId) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  return campaign;
}

/**
 * Updates a campaign. Only drafts can be updated.
 */
async function updateCampaign(requestContext, campaignId, data) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (campaign.status !== 'draft') {
    throw AppError.badRequest('Only draft campaigns can be updated');
  }

  // If template_id is being changed, validate the new template
  if (data.template_id && data.template_id !== campaign.template_id) {
    const templateData = await fetchTemplate(requestContext, data.template_id);
    const template = templateData.template || templateData;
    assertTemplateEligibleForCampaign(template);
  }

  if (data.wa_account_id || data.template_id) {
    const nextWaAccountId = data.wa_account_id || campaign.wa_account_id;
    const nextTemplateId = data.template_id || campaign.template_id;
    const [account, templateData] = await Promise.all([
      findActiveWaAccount(userId, nextWaAccountId),
      fetchTemplate(requestContext, nextTemplateId),
    ]);

    if (!account) {
      throw AppError.badRequest('Select an active WhatsApp account before updating this campaign.');
    }

    const template = templateData.template || templateData;
    assertTemplateEligibleForCampaign(template);
    assertTemplateMatchesWaAccount(template, account);
    await assertTemplateAccountCapabilities(requestContext, nextWaAccountId, template);
  }

  // Recalculate estimated cost if target changes
  if (data.target_config || data.target_type || data.template_id) {
    const targetType = data.target_type || campaign.target_type;
    const targetConfig = data.target_config || campaign.target_config;
    const templateData = await fetchTemplate(requestContext, data.template_id || campaign.template_id);
    const template = templateData.template || templateData;
    assertTemplateEligibleForCampaign(template);
    const estimatedRecipients = await estimateCampaignRecipients(requestContext, targetType, targetConfig);
    const pricing = await getCampaignExecutionPricing(
      userId,
      estimatedRecipients,
      template.category
    );
    data.estimated_cost = pricing.estimatedCost;
  }

  const nextTemplateId = data.template_id || campaign.template_id;
  const nextTemplateData = await fetchTemplate(requestContext, nextTemplateId);
  const nextTemplate = nextTemplateData.template || nextTemplateData;
  assertTemplateEligibleForCampaign(nextTemplate);
  const nextWaAccountId = data.wa_account_id || campaign.wa_account_id;
  await assertTemplateAccountCapabilities(requestContext, nextWaAccountId, nextTemplate);

  const nextBindings = await normalizeCampaignTemplateBindings(
    requestContext,
    nextTemplate,
    data.template_bindings !== undefined ? data.template_bindings : campaign.template_bindings,
    data.variables_mapping !== undefined ? data.variables_mapping : campaign.variables_mapping
  );

  data.template_bindings = nextBindings.templateBindings;
  data.variables_mapping = nextBindings.legacyVariablesMapping;

  await campaign.update(data);
  await campaign.reload();

  return campaign;
}

/**
 * Soft-deletes a campaign. Only drafts can be deleted.
 */
async function deleteCampaign(requestContext, campaignId) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (campaign.status !== 'draft') {
    throw AppError.badRequest('Only draft campaigns can be deleted');
  }

  await campaign.destroy();

  return { id: campaignId };
}

/**
 * Starts campaign execution.
 * Resolves contacts, creates message records, publishes to Kafka in batches of 50.
 */
async function startCampaign(requestContext, campaignId, kafkaProducer) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    throw AppError.badRequest(`Campaign cannot be started. Current status: ${campaign.status}`);
  }

  if (!kafkaProducer) {
    throw AppError.internal('Message broker is not available. Cannot start campaign.');
  }

  const [account, templateData] = await Promise.all([
    findActiveWaAccount(userId, campaign.wa_account_id),
    fetchTemplate(requestContext, campaign.template_id),
  ]);

  if (!account) {
    throw AppError.badRequest('The WhatsApp account selected for this campaign is no longer active.');
  }

  const template = templateData.template || templateData;
  assertTemplateEligibleForCampaign(template);
  assertTemplateMatchesWaAccount(template, account);
  const templateRequirements = extractTemplateBindingRequirements(template);
  await assertTemplateAccountCapabilities(
    requestContext,
    campaign.wa_account_id,
    template,
    templateRequirements
  );
  const normalizedBindings = await normalizeCampaignTemplateBindings(
    requestContext,
    template,
    campaign.template_bindings,
    campaign.variables_mapping
  );

  // 1. Resolve target contacts
  const contacts = await resolveContacts(requestContext, campaign.target_type, campaign.target_config);

  if (contacts.length === 0) {
    throw AppError.badRequest('No contacts found matching the target criteria');
  }

  const executionPricing = await assertCampaignExecutionAffordable(
    userId,
    contacts.length,
    template.category
  );
  const resolvedMediaBindings = await resolveCampaignMediaBindings(
    requestContext,
    campaign.wa_account_id,
    normalizedBindings.templateBindings?.media
  );

  // 2. Create CampaignMessage records for each contact
  const messageRecords = contacts.map((contact) => {
    const phone = contact.phone || contact.phone_number || contact.wa_id || '';
    const resolvedVars = resolveVariables(
      contact,
      normalizedBindings.templateBindings?.variables || normalizedBindings.legacyVariablesMapping
    );

    return {
      id: generateUUID(),
      campaign_id: campaign.id,
      contact_id: contact.id,
      contact_phone: phone,
      status: 'pending',
      variables: resolvedVars,
      cost: executionPricing.unitPrice,
      retry_count: 0,
      max_retries: 3,
    };
  });

  // Bulk create message records
  await CampaignMessage.bulkCreate(messageRecords);

  // 3. Mark the campaign as running before any worker status can race back in.
  await campaign.update({
    status: 'running',
    started_at: new Date(),
    total_recipients: contacts.length,
    pending_count: contacts.length,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    estimated_cost: executionPricing.estimatedCost,
  });

  // 4. Publish to Kafka in batches of 50
  const batchSize = 50;
  for (let i = 0; i < messageRecords.length; i += batchSize) {
    const batch = messageRecords.slice(i, i + batchSize);
    const publishPromises = batch.map((msg) => {
      const resolvedVars = msg.variables || {};
      const components = buildTemplateComponents(
        template,
        resolvedVars,
        resolvedMediaBindings,
        normalizedBindings.templateBindings?.locations || {},
        normalizedBindings.templateBindings?.products || {}
      );

      return publishEvent(kafkaProducer, TOPICS.CAMPAIGN_EXECUTE, campaign.id, {
        campaignId: campaign.id,
        campaignMessageId: msg.id,
        userId: userId,
        waAccountId: campaign.wa_account_id,
        contactId: msg.contact_id,
        phoneNumber: msg.contact_phone,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        templateCategory: template.category || undefined,
        components: components.length > 0 ? components : undefined,
        messageType: 'template',
      });
    });

    await Promise.all(publishPromises);
  }

  await campaign.reload();

  return campaign;
}

/**
 * Pauses a running campaign.
 */
async function pauseCampaign(requestContext, campaignId) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (campaign.status !== 'running') {
    throw AppError.badRequest(`Campaign cannot be paused. Current status: ${campaign.status}`);
  }

  await campaign.update({ status: 'paused' });
  await campaign.reload();

  return campaign;
}

/**
 * Resumes a paused campaign by re-publishing pending messages to Kafka.
 */
async function resumeCampaign(requestContext, campaignId, kafkaProducer) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (campaign.status !== 'paused') {
    throw AppError.badRequest(`Campaign cannot be resumed. Current status: ${campaign.status}`);
  }

  if (!kafkaProducer) {
    throw AppError.internal('Message broker is not available. Cannot resume campaign.');
  }

  const [account, templateData] = await Promise.all([
    findActiveWaAccount(userId, campaign.wa_account_id),
    fetchTemplate(requestContext, campaign.template_id),
  ]);

  if (!account) {
    throw AppError.badRequest('The WhatsApp account selected for this campaign is no longer active.');
  }

  const template = templateData.template || templateData;
  assertTemplateEligibleForCampaign(template);
  assertTemplateMatchesWaAccount(template, account);
  const templateRequirements = extractTemplateBindingRequirements(template);
  await assertTemplateAccountCapabilities(
    requestContext,
    campaign.wa_account_id,
    template,
    templateRequirements
  );
  const normalizedBindings = await normalizeCampaignTemplateBindings(
    requestContext,
    template,
    campaign.template_bindings,
    campaign.variables_mapping
  );
  const resolvedMediaBindings = await resolveCampaignMediaBindings(
    requestContext,
    campaign.wa_account_id,
    normalizedBindings.templateBindings?.media
  );

  // Find pending messages
  const pendingMessages = await CampaignMessage.findAll({
    where: { campaign_id: campaign.id, status: 'pending' },
  });

  if (pendingMessages.length === 0) {
    const failedMessages = await CampaignMessage.count({
      where: { campaign_id: campaign.id, status: 'failed' },
    });

    await campaign.update({
      status: failedMessages > 0 ? 'failed' : 'completed',
      completed_at: new Date(),
      pending_count: 0,
    });
    await campaign.reload();
    return campaign;
  }

  await assertCampaignExecutionAffordable(
    userId,
    pendingMessages.length,
    template.category
  );

  await campaign.update({
    status: 'running',
    pending_count: pendingMessages.length,
  });

  // Re-publish pending messages to Kafka in batches of 50
  const batchSize = 50;
  for (let i = 0; i < pendingMessages.length; i += batchSize) {
    const batch = pendingMessages.slice(i, i + batchSize);
    const publishPromises = batch.map((msg) => {
      const resolvedVars = msg.variables || {};
      const components = buildTemplateComponents(
        template,
        resolvedVars,
        resolvedMediaBindings,
        normalizedBindings.templateBindings?.locations || {},
        normalizedBindings.templateBindings?.products || {}
      );

      return publishEvent(kafkaProducer, TOPICS.CAMPAIGN_EXECUTE, campaign.id, {
        campaignId: campaign.id,
        campaignMessageId: msg.id,
        userId: userId,
        waAccountId: campaign.wa_account_id,
        contactId: msg.contact_id,
        phoneNumber: msg.contact_phone,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        templateCategory: template.category || undefined,
        components: components.length > 0 ? components : undefined,
        messageType: 'template',
      });
    });

    await Promise.all(publishPromises);
  }
  await campaign.reload();

  return campaign;
}

/**
 * Cancels a campaign. Updates all pending/queued messages to failed.
 */
async function cancelCampaign(requestContext, campaignId) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (!['draft', 'scheduled', 'running', 'paused'].includes(campaign.status)) {
    throw AppError.badRequest(`Campaign cannot be cancelled. Current status: ${campaign.status}`);
  }

  // Update all pending/queued messages to failed
  const [updatedCount] = await CampaignMessage.update(
    {
      status: 'failed',
      error_message: 'Campaign cancelled',
      failed_at: new Date(),
    },
    {
      where: {
        campaign_id: campaign.id,
        status: { [Op.in]: ['pending', 'queued'] },
      },
    }
  );

  // Update campaign status and counters
  await campaign.update({
    status: 'cancelled',
    completed_at: new Date(),
    failed_count: sequelize.literal(`failed_count + ${updatedCount}`),
    pending_count: 0,
  });

  await campaign.reload();

  return campaign;
}

/**
 * Retries failed messages in a campaign.
 * Only retries messages where retry_count < max_retries.
 */
async function retryCampaign(requestContext, campaignId, kafkaProducer) {
  const userId = resolveScopeId(requestContext);
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  if (!['completed', 'failed', 'paused'].includes(campaign.status)) {
    throw AppError.badRequest(`Campaign cannot be retried. Current status: ${campaign.status}`);
  }

  if (!kafkaProducer) {
    throw AppError.internal('Message broker is not available. Cannot retry campaign.');
  }

  const [account, templateData] = await Promise.all([
    findActiveWaAccount(userId, campaign.wa_account_id),
    fetchTemplate(requestContext, campaign.template_id),
  ]);

  if (!account) {
    throw AppError.badRequest('The WhatsApp account selected for this campaign is no longer active.');
  }

  const template = templateData.template || templateData;
  assertTemplateEligibleForCampaign(template);
  assertTemplateMatchesWaAccount(template, account);
  const templateRequirements = extractTemplateBindingRequirements(template);
  await assertTemplateAccountCapabilities(
    requestContext,
    campaign.wa_account_id,
    template,
    templateRequirements
  );
  const normalizedBindings = await normalizeCampaignTemplateBindings(
    requestContext,
    template,
    campaign.template_bindings,
    campaign.variables_mapping
  );
  const resolvedMediaBindings = await resolveCampaignMediaBindings(
    requestContext,
    campaign.wa_account_id,
    normalizedBindings.templateBindings?.media
  );

  // Find failed messages eligible for retry
  const failedMessages = await CampaignMessage.findAll({
    where: {
      campaign_id: campaign.id,
      status: 'failed',
      retry_count: { [Op.lt]: sequelize.col('max_retries') },
    },
  });

  if (failedMessages.length === 0) {
    throw AppError.badRequest('No failed messages eligible for retry');
  }

  await assertCampaignExecutionAffordable(
    userId,
    failedMessages.length,
    template.category
  );

  // Increment retry_count and reset status to pending until WhatsApp accepts the retry.
  const messageIds = failedMessages.map((m) => m.id);
  await CampaignMessage.update(
    {
      status: 'pending',
      retry_count: sequelize.literal('retry_count + 1'),
      error_code: null,
      error_message: null,
      failed_at: null,
    },
    {
      where: { id: { [Op.in]: messageIds } },
    }
  );

  await campaign.update({
    status: 'running',
    failed_count: sequelize.literal(`GREATEST(failed_count - ${failedMessages.length}, 0)`),
    pending_count: sequelize.literal(`pending_count + ${failedMessages.length}`),
  });

  // Publish to Kafka in batches of 50
  const batchSize = 50;
  for (let i = 0; i < failedMessages.length; i += batchSize) {
    const batch = failedMessages.slice(i, i + batchSize);
    const publishPromises = batch.map((msg) => {
      const resolvedVars = msg.variables || {};
      const components = buildTemplateComponents(
        template,
        resolvedVars,
        resolvedMediaBindings,
        normalizedBindings.templateBindings?.locations || {},
        normalizedBindings.templateBindings?.products || {}
      );

      return publishEvent(kafkaProducer, TOPICS.CAMPAIGN_EXECUTE, campaign.id, {
        campaignId: campaign.id,
        campaignMessageId: msg.id,
        userId: userId,
        waAccountId: campaign.wa_account_id,
        contactId: msg.contact_id,
        phoneNumber: msg.contact_phone,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        templateCategory: template.category || undefined,
        components: components.length > 0 ? components : undefined,
        messageType: 'template',
      });
    });

    await Promise.all(publishPromises);
  }

  await campaign.reload();

  return campaign;
}

async function getCampaignExecutionDispatchState(requestContext, campaignId, campaignMessageId) {
  const userId = resolveScopeId(requestContext);
  const campaignMessage = await CampaignMessage.findOne({
    where: {
      id: campaignMessageId,
      campaign_id: campaignId,
    },
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'status', 'user_id'],
        where: { user_id: userId },
      },
    ],
  });

  if (!campaignMessage) {
    return {
      executable: false,
      reason: 'campaign_message_not_found',
      campaignStatus: null,
      messageStatus: null,
    };
  }

  const campaignStatus = campaignMessage.campaign?.status || null;
  const messageStatus = campaignMessage.status || null;

  if (campaignStatus !== 'running') {
    return {
      executable: false,
      reason: `campaign_${campaignStatus || 'unknown'}`,
      campaignStatus,
      messageStatus,
    };
  }

  if (!['pending', 'queued'].includes(messageStatus)) {
    return {
      executable: false,
      reason: `message_${messageStatus || 'unknown'}`,
      campaignStatus,
      messageStatus,
    };
  }

  return {
    executable: true,
    reason: 'ready',
    campaignStatus,
    messageStatus,
  };
}

/**
 * Lists messages for a campaign with pagination and optional status filter.
 */
async function getCampaignMessages(requestContext, campaignId, filters) {
  const userId = resolveScopeId(requestContext);
  // Verify campaign belongs to user
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
    attributes: ['id'],
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  const { page, limit, status } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = { campaign_id: campaignId };
  if (status) {
    where.status = status;
  }

  const { rows: messages, count: total } = await CampaignMessage.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { messages, meta };
}

/**
 * Gets detailed analytics for a campaign.
 */
async function getCampaignAnalytics(requestContext, campaignId) {
  const userId = resolveScopeId(requestContext);
  // Verify campaign belongs to user
  const campaign = await Campaign.findOne({
    where: { id: campaignId, user_id: userId },
  });

  if (!campaign) {
    throw AppError.notFound('Campaign not found');
  }

  // Get status breakdown
  const statusBreakdown = await CampaignMessage.findAll({
    where: { campaign_id: campaignId },
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  });

  const statusMap = {};
  statusBreakdown.forEach((row) => {
    statusMap[row.status] = parseInt(row.count, 10);
  });

  const total = campaign.total_recipients || 0;
  const sent = statusMap.sent || 0;
  const delivered = statusMap.delivered || 0;
  const read = statusMap.read || 0;
  const failed = statusMap.failed || 0;
  const pending = (statusMap.pending || 0) + (statusMap.queued || 0);

  // Calculate rates (avoid division by zero)
  const processedCount = total - pending;
  const deliveryRate = processedCount > 0 ? ((delivered + read) / processedCount * 100).toFixed(2) : '0.00';
  const readRate = (delivered + read) > 0 ? (read / (delivered + read) * 100).toFixed(2) : '0.00';
  const failureRate = processedCount > 0 ? (failed / processedCount * 100).toFixed(2) : '0.00';

  // Get failure reasons breakdown
  const failureReasons = await CampaignMessage.findAll({
    where: {
      campaign_id: campaignId,
      status: 'failed',
      error_message: { [Op.not]: null },
    },
    attributes: [
      'error_message',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['error_message'],
    order: [[sequelize.literal('count'), 'DESC']],
    limit: 10,
    raw: true,
  });

  // Get cost breakdown
  const costData = await CampaignMessage.findOne({
    where: { campaign_id: campaignId },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('cost')), 'total_cost'],
    ],
    raw: true,
  });

  // Get hourly timeline for sent messages
  const hourlyTimeline = await CampaignMessage.findAll({
    where: {
      campaign_id: campaignId,
      sent_at: { [Op.not]: null },
    },
    attributes: [
      [sequelize.fn('DATE_FORMAT', sequelize.col('sent_at'), '%Y-%m-%d %H:00:00'), 'hour'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: [sequelize.fn('DATE_FORMAT', sequelize.col('sent_at'), '%Y-%m-%d %H:00:00')],
    order: [[sequelize.literal('hour'), 'ASC']],
    raw: true,
  });

  return {
    campaign_id: campaignId,
    campaign_name: campaign.name,
    status: campaign.status,
    started_at: campaign.started_at,
    completed_at: campaign.completed_at,
    summary: {
      total,
      sent,
      delivered,
      read,
      failed,
      pending,
    },
    rates: {
      delivery_rate: parseFloat(deliveryRate),
      read_rate: parseFloat(readRate),
      failure_rate: parseFloat(failureRate),
    },
    failure_reasons: failureReasons.map((r) => ({
      reason: r.error_message,
      count: parseInt(r.count, 10),
    })),
    cost: {
      estimated: campaign.estimated_cost,
      actual: parseInt(costData?.total_cost || 0, 10),
    },
    hourly_timeline: hourlyTimeline.map((h) => ({
      hour: h.hour,
      count: parseInt(h.count, 10),
    })),
  };
}

/**
 * Handles campaign status updates from Kafka consumer (campaign.status topic).
 * Updates CampaignMessage and Campaign aggregate counters.
 * Returns data for Socket.IO emission.
 */
async function handleStatusUpdate(statusPayload) {
  const { campaignId, contactId, messageId, status, timestamp, errorCode, errorMessage } = statusPayload;

  // Find the campaign message by campaignId and contactId
  const campaignMessage = await CampaignMessage.findOne({
    where: { campaign_id: campaignId, contact_id: contactId },
  });

  if (!campaignMessage) {
    // Try to find by meta_message_id if contactId didn't match
    if (messageId) {
      const msgByMetaId = await CampaignMessage.findOne({
        where: { campaign_id: campaignId, meta_message_id: messageId },
      });
      if (!msgByMetaId) {
        console.warn('[campaign-service] Campaign status diagnostic', JSON.stringify({
          campaign_id: campaignId,
          contact_id: contactId,
          message_id: messageId,
          status,
          matched_campaign_message: false,
          lookup: 'contact_id_then_meta_message_id',
        }));
        return null;
      }
      // Process with the found message
      return await processStatusUpdate(msgByMetaId, campaignId, status, messageId, timestamp, errorCode, errorMessage);
    }
    console.warn('[campaign-service] Campaign status diagnostic', JSON.stringify({
      campaign_id: campaignId,
      contact_id: contactId,
      message_id: messageId || null,
      status,
      matched_campaign_message: false,
      lookup: 'contact_id',
    }));
    return null;
  }

  return await processStatusUpdate(campaignMessage, campaignId, status, messageId, timestamp, errorCode, errorMessage);
}

/**
 * Processes a status update for a specific campaign message.
 * Updates the message status and campaign aggregate counters atomically.
 */
async function processStatusUpdate(campaignMessage, campaignId, status, messageId, timestamp, errorCode, errorMessage) {
  const previousStatus = campaignMessage.status;
  const pendingStatuses = new Set(['pending', 'queued']);

  // Determine if this is a forward progression (avoid going backward in status)
  // Order: pending → queued → sent → delivered → read
  // failed can happen at any point
  const statusOrder = { pending: 0, queued: 1, sent: 2, delivered: 3, read: 4, failed: -1 };
  const currentOrder = statusOrder[previousStatus] || 0;
  const newOrder = statusOrder[status] || 0;

  // For failed status, always allow. For others, only process if advancing forward.
  if (status !== 'failed' && newOrder <= currentOrder && previousStatus !== 'pending' && previousStatus !== 'queued') {
    return null;
  }

  // Update the message record
  const updateData = { status };
  if (messageId && !campaignMessage.meta_message_id) {
    updateData.meta_message_id = messageId;
  }

  switch (status) {
    case 'sent':
      updateData.sent_at = timestamp ? new Date(timestamp) : new Date();
      break;
    case 'delivered':
      updateData.delivered_at = timestamp ? new Date(timestamp) : new Date();
      if (!campaignMessage.sent_at) {
        updateData.sent_at = updateData.delivered_at;
      }
      break;
    case 'read':
      updateData.read_at = timestamp ? new Date(timestamp) : new Date();
      if (!campaignMessage.delivered_at) {
        updateData.delivered_at = updateData.read_at;
      }
      if (!campaignMessage.sent_at) {
        updateData.sent_at = updateData.read_at;
      }
      break;
    case 'failed':
      updateData.failed_at = timestamp ? new Date(timestamp) : new Date();
      if (errorCode) updateData.error_code = String(errorCode);
      if (errorMessage) updateData.error_message = errorMessage;
      break;
  }

  await campaignMessage.update(updateData);

  // Update campaign aggregate counters atomically
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) {
    return null;
  }

  // Build counter update based on status transition
  const counterUpdate = {};

  // Keep pending_count aligned with unresolved pending/queued work.
  if (pendingStatuses.has(previousStatus) && !pendingStatuses.has(status)) {
    counterUpdate.pending_count = sequelize.literal('GREATEST(pending_count - 1, 0)');
  } else if (previousStatus === 'sent') {
    counterUpdate.sent_count = sequelize.literal('GREATEST(sent_count - 1, 0)');
  } else if (previousStatus === 'delivered') {
    counterUpdate.delivered_count = sequelize.literal('GREATEST(delivered_count - 1, 0)');
  }

  // Increment the new status counter
  switch (status) {
    case 'sent':
      counterUpdate.sent_count = counterUpdate.sent_count
        ? sequelize.literal('sent_count')
        : sequelize.literal('sent_count + 1');
      break;
    case 'delivered':
      counterUpdate.delivered_count = counterUpdate.delivered_count
        ? sequelize.literal('delivered_count')
        : sequelize.literal('delivered_count + 1');
      break;
    case 'read':
      counterUpdate.read_count = sequelize.literal('read_count + 1');
      break;
    case 'failed':
      counterUpdate.failed_count = sequelize.literal('failed_count + 1');
      break;
  }

  await Campaign.update(counterUpdate, {
    where: { id: campaignId },
  });

  // Check if all messages have moved past the pending/queued pipeline stages.
  const pendingCount = await CampaignMessage.count({
    where: {
      campaign_id: campaignId,
      status: { [Op.in]: ['pending', 'queued'] },
    },
  });

  if (pendingCount === 0 && ['running', 'paused'].includes(campaign.status)) {
    const failedCount = await CampaignMessage.count({
      where: {
        campaign_id: campaignId,
        status: 'failed',
      },
    });

    await Campaign.update(
      {
        status: failedCount > 0 ? 'failed' : 'completed',
        completed_at: new Date(),
        pending_count: 0,
      },
      { where: { id: campaignId } }
    );
  }

  // Reload campaign to get updated stats
  await campaign.reload();

  console.log('[campaign-service] Campaign status diagnostic', JSON.stringify({
    campaign_id: campaignId,
    campaign_message_id: campaignMessage.id,
    contact_id: campaignMessage.contact_id,
    message_id: messageId || campaignMessage.meta_message_id || null,
    previous_status: previousStatus,
    next_status: status,
    matched_campaign_message: true,
  }));

  return {
    organizationId: campaign.user_id,
    stats: {
      total_recipients: campaign.total_recipients,
      sent_count: campaign.sent_count,
      delivered_count: campaign.delivered_count,
      read_count: campaign.read_count,
      failed_count: campaign.failed_count,
      pending_count: campaign.pending_count,
      status: campaign.status,
    },
  };
}

module.exports = {
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryCampaign,
  getCampaignExecutionDispatchState,
  getCampaignMessages,
  getCampaignAnalytics,
  handleStatusUpdate,
  __private: {
    assertTemplateEligibleForCampaign,
    assertTargetSelection,
    canonicalizeTemplateMediaBindings,
    fetchTemplate,
    fetchAllContactsByQuery,
    fetchContactsByGroupIds,
    fetchContactsByIds,
    fetchContactsByTagIds,
    normalizeCampaignTemplateBindings,
    normalizeIdArray,
    resolveCampaignProductCatalogSupport,
    resolveCampaignMediaBindings,
    resolveContacts,
    splitIntoBatches,
  },
};
