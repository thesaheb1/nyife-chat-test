'use strict';

const { Op } = require('sequelize');
const axios = require('axios');
const { Campaign, CampaignMessage, sequelize } = require('../models');
const { AppError, getPagination, getPaginationMeta, generateUUID } = require('@nyife/shared-utils');
const { TOPICS, publishEvent } = require('@nyife/shared-events');
const { resolveVariables, buildTemplateComponents } = require('../helpers/variableResolver');
const config = require('../config');

// ────────────────────────────────────────────────
// Helper: Inter-service HTTP calls
// ────────────────────────────────────────────────

/**
 * Checks subscription limit for a given resource.
 * @param {string} userId
 * @param {string} resource - e.g., 'campaigns_per_month'
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
 * @param {string} userId
 * @param {string} templateId
 * @returns {Promise<object>} Template data
 */
async function fetchTemplate(userId, templateId) {
  try {
    const response = await axios.get(
      `${config.templateServiceUrl}/api/v1/templates/${templateId}`,
      {
        headers: { 'x-user-id': userId },
        timeout: 5000,
      }
    );
    return response.data.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw AppError.notFound('Template not found');
    }
    console.error('[campaign-service] Failed to fetch template:', err.message);
    throw AppError.internal('Unable to fetch template details');
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

/**
 * Resolves contacts from contact-service based on target type and config.
 * @param {string} userId
 * @param {string} targetType
 * @param {object} targetConfig
 * @returns {Promise<Array>} Array of contact objects
 */
async function resolveContacts(userId, targetType, targetConfig) {
  const headers = { 'x-user-id': userId };
  const baseUrl = `${config.contactServiceUrl}/api/v1/contacts`;
  let contacts = [];

  try {
    switch (targetType) {
      case 'contacts': {
        const contactIds = targetConfig.contact_ids || [];
        if (contactIds.length === 0) {
          throw AppError.badRequest('No contact IDs provided in target_config');
        }
        const response = await axios.get(baseUrl, {
          params: { ids: contactIds.join(','), limit: 10000 },
          headers,
          timeout: 15000,
        });
        contacts = response.data.data?.contacts || response.data.data || [];
        break;
      }

      case 'group': {
        const groupIds = targetConfig.group_ids || [];
        if (groupIds.length === 0) {
          throw AppError.badRequest('No group IDs provided in target_config');
        }
        // Fetch contacts for each group
        for (const groupId of groupIds) {
          const response = await axios.get(baseUrl, {
            params: { group_id: groupId, limit: 10000 },
            headers,
            timeout: 15000,
          });
          const groupContacts = response.data.data?.contacts || response.data.data || [];
          contacts = contacts.concat(groupContacts);
        }
        break;
      }

      case 'tags': {
        const tagIds = targetConfig.tag_ids || [];
        if (tagIds.length === 0) {
          throw AppError.badRequest('No tag IDs provided in target_config');
        }
        const response = await axios.get(baseUrl, {
          params: { tag_ids: tagIds.join(','), limit: 10000 },
          headers,
          timeout: 15000,
        });
        contacts = response.data.data?.contacts || response.data.data || [];
        break;
      }

      case 'all': {
        const response = await axios.get(baseUrl, {
          params: { limit: 10000 },
          headers,
          timeout: 15000,
        });
        contacts = response.data.data?.contacts || response.data.data || [];
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

  return contacts;
}

// ────────────────────────────────────────────────
// Service Functions
// ────────────────────────────────────────────────

/**
 * Creates a new campaign in draft status.
 * Validates subscription limit, template existence, and calculates estimated cost.
 */
async function createCampaign(userId, data) {
  // 1. Check subscription limit for campaigns_per_month
  const limitCheck = await checkSubscriptionLimit(userId, 'campaigns_per_month');
  if (!limitCheck.allowed) {
    throw AppError.forbidden(
      `Campaign limit reached. You have ${limitCheck.remaining} campaigns remaining this month.`
    );
  }

  // 2. Validate template exists and is approved
  const templateData = await fetchTemplate(userId, data.template_id);
  const template = templateData.template || templateData;
  if (template.status && template.status !== 'APPROVED' && template.status !== 'approved') {
    throw AppError.badRequest(`Template is not approved. Current status: ${template.status}`);
  }

  // 3. Estimate recipient count based on target_type
  let estimatedRecipients = 0;
  if (data.target_type === 'contacts') {
    estimatedRecipients = (data.target_config.contact_ids || []).length;
  } else {
    // For group/tags/all, we estimate; actual count is resolved at execution time
    estimatedRecipients = 100; // Default estimate
  }

  // 4. Calculate estimated cost (default 50 paise per message if pricing unavailable)
  const costPerMessage = 50; // In paise, fallback
  const estimatedCost = estimatedRecipients * costPerMessage;

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
    variables_mapping: data.variables_mapping || null,
    scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
    estimated_cost: estimatedCost,
  });

  // 6. Increment subscription usage
  await incrementSubscriptionUsage(userId, 'campaigns_per_month', 1);

  return campaign;
}

/**
 * Lists campaigns for a user with pagination, search, status, and date filters.
 */
async function listCampaigns(userId, filters) {
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
async function getCampaign(userId, campaignId) {
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
async function updateCampaign(userId, campaignId, data) {
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
    const templateData = await fetchTemplate(userId, data.template_id);
    const template = templateData.template || templateData;
    if (template.status && template.status !== 'APPROVED' && template.status !== 'approved') {
      throw AppError.badRequest(`Template is not approved. Current status: ${template.status}`);
    }
  }

  // Recalculate estimated cost if target changes
  if (data.target_config || data.target_type) {
    const targetType = data.target_type || campaign.target_type;
    const targetConfig = data.target_config || campaign.target_config;
    let estimatedRecipients = 0;
    if (targetType === 'contacts') {
      estimatedRecipients = (targetConfig.contact_ids || []).length;
    } else {
      estimatedRecipients = 100;
    }
    const costPerMessage = 50;
    data.estimated_cost = estimatedRecipients * costPerMessage;
  }

  await campaign.update(data);
  await campaign.reload();

  return campaign;
}

/**
 * Soft-deletes a campaign. Only drafts can be deleted.
 */
async function deleteCampaign(userId, campaignId) {
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
async function startCampaign(userId, campaignId, kafkaProducer) {
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

  // 1. Check subscription message limit
  const msgLimitCheck = await checkSubscriptionLimit(userId, 'messages_per_month');
  if (!msgLimitCheck.allowed) {
    throw AppError.forbidden('Monthly message limit reached. Please upgrade your plan.');
  }

  // 2. Check wallet balance
  const walletData = await checkWalletBalance(userId);
  if (walletData.balance < campaign.estimated_cost) {
    throw AppError.badRequest(
      `Insufficient wallet balance. Required: ${campaign.estimated_cost} paise, Available: ${walletData.balance} paise`
    );
  }

  // 3. Resolve target contacts
  const contacts = await resolveContacts(userId, campaign.target_type, campaign.target_config);

  if (contacts.length === 0) {
    throw AppError.badRequest('No contacts found matching the target criteria');
  }

  // 4. Fetch template details
  const templateData = await fetchTemplate(userId, campaign.template_id);
  const template = templateData.template || templateData;

  // 5. Create CampaignMessage records for each contact
  const messageRecords = contacts.map((contact) => {
    const phone = contact.phone || contact.phone_number || contact.wa_id || '';
    const resolvedVars = resolveVariables(contact, campaign.variables_mapping);

    return {
      id: generateUUID(),
      campaign_id: campaign.id,
      contact_id: contact.id,
      contact_phone: phone,
      status: 'pending',
      variables: resolvedVars,
      retry_count: 0,
      max_retries: 3,
    };
  });

  // Bulk create message records
  await CampaignMessage.bulkCreate(messageRecords);

  // 6. Publish to Kafka in batches of 50
  const batchSize = 50;
  for (let i = 0; i < messageRecords.length; i += batchSize) {
    const batch = messageRecords.slice(i, i + batchSize);
    const publishPromises = batch.map((msg) => {
      const resolvedVars = msg.variables || {};
      const components = buildTemplateComponents(template, resolvedVars);

      return publishEvent(kafkaProducer, TOPICS.CAMPAIGN_EXECUTE, campaign.id, {
        campaignId: campaign.id,
        userId: userId,
        waAccountId: campaign.wa_account_id,
        contactId: msg.contact_id,
        phoneNumber: msg.contact_phone,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        components: components.length > 0 ? components : undefined,
        messageType: 'template',
      });
    });

    await Promise.all(publishPromises);
  }

  // 7. Update campaign status and counters
  await campaign.update({
    status: 'running',
    started_at: new Date(),
    total_recipients: contacts.length,
    pending_count: contacts.length,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    failed_count: 0,
    estimated_cost: contacts.length * 50, // Recalculate with actual count
  });

  await campaign.reload();

  return campaign;
}

/**
 * Pauses a running campaign.
 */
async function pauseCampaign(userId, campaignId) {
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
async function resumeCampaign(userId, campaignId, kafkaProducer) {
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

  // Find pending messages
  const pendingMessages = await CampaignMessage.findAll({
    where: { campaign_id: campaign.id, status: 'pending' },
  });

  if (pendingMessages.length === 0) {
    // No pending messages, mark as completed
    await campaign.update({ status: 'completed', completed_at: new Date() });
    await campaign.reload();
    return campaign;
  }

  // Fetch template details
  const templateData = await fetchTemplate(userId, campaign.template_id);
  const template = templateData.template || templateData;

  // Re-publish pending messages to Kafka in batches of 50
  const batchSize = 50;
  for (let i = 0; i < pendingMessages.length; i += batchSize) {
    const batch = pendingMessages.slice(i, i + batchSize);
    const publishPromises = batch.map((msg) => {
      const resolvedVars = msg.variables || {};
      const components = buildTemplateComponents(template, resolvedVars);

      return publishEvent(kafkaProducer, TOPICS.CAMPAIGN_EXECUTE, campaign.id, {
        campaignId: campaign.id,
        userId: userId,
        waAccountId: campaign.wa_account_id,
        contactId: msg.contact_id,
        phoneNumber: msg.contact_phone,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        components: components.length > 0 ? components : undefined,
        messageType: 'template',
      });
    });

    await Promise.all(publishPromises);
  }

  // Update campaign status
  await campaign.update({ status: 'running' });
  await campaign.reload();

  return campaign;
}

/**
 * Cancels a campaign. Updates all pending/queued messages to failed.
 */
async function cancelCampaign(userId, campaignId) {
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
async function retryCampaign(userId, campaignId, kafkaProducer) {
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

  // Fetch template details
  const templateData = await fetchTemplate(userId, campaign.template_id);
  const template = templateData.template || templateData;

  // Increment retry_count and reset status to queued
  const messageIds = failedMessages.map((m) => m.id);
  await CampaignMessage.update(
    {
      status: 'queued',
      retry_count: sequelize.literal('retry_count + 1'),
      error_code: null,
      error_message: null,
      failed_at: null,
    },
    {
      where: { id: { [Op.in]: messageIds } },
    }
  );

  // Publish to Kafka in batches of 50
  const batchSize = 50;
  for (let i = 0; i < failedMessages.length; i += batchSize) {
    const batch = failedMessages.slice(i, i + batchSize);
    const publishPromises = batch.map((msg) => {
      const resolvedVars = msg.variables || {};
      const components = buildTemplateComponents(template, resolvedVars);

      return publishEvent(kafkaProducer, TOPICS.CAMPAIGN_EXECUTE, campaign.id, {
        campaignId: campaign.id,
        userId: userId,
        waAccountId: campaign.wa_account_id,
        contactId: msg.contact_id,
        phoneNumber: msg.contact_phone,
        templateName: template.name,
        templateLanguage: template.language || 'en',
        components: components.length > 0 ? components : undefined,
        messageType: 'template',
      });
    });

    await Promise.all(publishPromises);
  }

  // Update campaign counters
  await campaign.update({
    status: 'running',
    failed_count: sequelize.literal(`failed_count - ${failedMessages.length}`),
    pending_count: sequelize.literal(`pending_count + ${failedMessages.length}`),
  });

  await campaign.reload();

  return campaign;
}

/**
 * Lists messages for a campaign with pagination and optional status filter.
 */
async function getCampaignMessages(userId, campaignId, filters) {
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
async function getCampaignAnalytics(userId, campaignId) {
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
        console.warn(
          `[campaign-service] CampaignMessage not found for campaign=${campaignId} contact=${contactId} messageId=${messageId}`
        );
        return null;
      }
      // Process with the found message
      return await processStatusUpdate(msgByMetaId, campaignId, status, messageId, timestamp, errorCode, errorMessage);
    }
    console.warn(
      `[campaign-service] CampaignMessage not found for campaign=${campaignId} contact=${contactId}`
    );
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

  // Decrement the previous status counter (if not pending/queued going to sent)
  if (previousStatus === 'pending' || previousStatus === 'queued') {
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

  // Check if all messages are processed (no more pending)
  const pendingCount = await CampaignMessage.count({
    where: {
      campaign_id: campaignId,
      status: { [Op.in]: ['pending', 'queued'] },
    },
  });

  if (pendingCount === 0 && campaign.status === 'running') {
    await Campaign.update(
      {
        status: 'completed',
        completed_at: new Date(),
        pending_count: 0,
      },
      { where: { id: campaignId } }
    );
  }

  // Reload campaign to get updated stats
  await campaign.reload();

  return {
    userId: campaign.user_id,
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
  getCampaignMessages,
  getCampaignAnalytics,
  handleStatusUpdate,
};
