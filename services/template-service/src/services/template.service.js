'use strict';

const { Op } = require('sequelize');
const axios = require('axios');
const { Template } = require('../models');
const { AppError, getPagination, getPaginationMeta } = require('@nyife/shared-utils');
const config = require('../config');

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
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/limits`,
      {
        headers: { 'x-user-id': userId },
        timeout: 5000,
      }
    );

    if (response.data && response.data.success) {
      const limits = response.data.data;
      if (limits && typeof limits.templates_max === 'number') {
        const currentCount = await Template.count({
          where: { user_id: userId },
        });
        if (currentCount >= limits.templates_max) {
          throw AppError.forbidden(
            `Template limit reached. Your plan allows a maximum of ${limits.templates_max} templates. Please upgrade your plan.`
          );
        }
      }
    }
  } catch (err) {
    // If the error is an AppError we threw, re-throw it
    if (err instanceof AppError) {
      throw err;
    }
    // If subscription service is unreachable, log warning and allow creation
    // This prevents template creation from being blocked when subscription-service is down
    console.warn('[template-service] Could not verify subscription limit:', err.message);
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
      `${config.subscriptionServiceUrl}/api/v1/subscriptions/usage`,
      {
        resource: 'templates',
        action,
      },
      {
        headers: { 'x-user-id': userId },
        timeout: 5000,
      }
    );
  } catch (err) {
    console.warn('[template-service] Could not update subscription usage:', err.message);
  }
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
    components: data.components,
    example_values: data.example_values || null,
  });

  // Notify subscription service (best-effort)
  notifySubscriptionUsage(userId, 'increment');

  return template;
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

  return { templates: rows, meta };
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

  return template;
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

  // If name is being changed, check uniqueness
  if (data.name && data.name !== template.name) {
    const whereClause = {
      user_id: userId,
      name: data.name,
      id: { [Op.ne]: templateId },
    };
    if (template.waba_id) {
      whereClause.waba_id = template.waba_id;
    } else {
      whereClause.waba_id = { [Op.is]: null };
    }

    const existing = await Template.findOne({ where: whereClause });
    if (existing) {
      throw AppError.conflict(
        `A template with the name "${data.name}" already exists${template.waba_id ? ` for WABA ${template.waba_id}` : ''}`
      );
    }
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
  if (data.waba_id !== undefined) updateFields.waba_id = data.waba_id;

  // If the template was rejected and is being re-edited, reset status to draft
  if (template.status === 'rejected') {
    updateFields.status = 'draft';
    updateFields.rejection_reason = null;
    updateFields.meta_template_id = null;
  }

  await template.update(updateFields);

  return template;
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
    if (!accessToken) {
      throw AppError.badRequest(
        'Access token (x-wa-access-token header) is required to delete a published template from Meta'
      );
    }

    try {
      await axios.delete(
        `${config.meta.baseUrl}/${template.waba_id}/message_templates`,
        {
          params: { name: template.name },
          headers: {
            Authorization: `Bearer ${accessToken}`,
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

  // Notify subscription service (best-effort)
  notifySubscriptionUsage(userId, 'decrement');
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

  if (!accessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for publishing. Provide it via the x-wa-access-token header.'
    );
  }

  // Build Meta API payload
  const payload = {
    name: template.name,
    language: template.language,
    category: template.category,
    components: template.components,
  };

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
          Authorization: `Bearer ${accessToken}`,
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

  return template;
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
  if (!accessToken) {
    throw AppError.badRequest(
      'WhatsApp access token is required for syncing. Provide it via the x-wa-access-token header.'
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
          Authorization: `Bearer ${accessToken}`,
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
      await localTemplate.update({
        status: metaStatus,
        meta_template_id: metaId,
        components: metaComponents,
        category: metaCategory,
        language: metaLanguage,
        rejection_reason: rejectionReason,
        last_synced_at: new Date(),
      });
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
};
