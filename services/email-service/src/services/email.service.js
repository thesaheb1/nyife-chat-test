'use strict';

const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const { Email, EmailTemplate } = require('../models');
const { AppError, getPagination, getPaginationMeta, generateUUID } = require('@nyife/shared-utils');
const { renderEmailFromTemplate } = require('../helpers/templateRenderer');
const config = require('../config');

// ────────────────────────────────────────────────
// Nodemailer Transporter
// ────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.auth.user,
    pass: config.smtp.auth.pass,
  },
});

// Maximum retry attempts for failed emails
const MAX_RETRIES = 3;

function getTemplateNameCandidates(templateName) {
  const trimmed = String(templateName || '').trim();
  if (!trimmed) {
    return [];
  }

  const alternate = trimmed.includes('-')
    ? trimmed.replace(/-/g, '_')
    : trimmed.includes('_')
      ? trimmed.replace(/_/g, '-')
      : null;

  return alternate && alternate !== trimmed ? [trimmed, alternate] : [trimmed];
}

function normalizeTemplateVariables(variables) {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
    return {};
  }

  const normalized = { ...variables };

  if (!normalized.name && typeof normalized.firstName === 'string' && normalized.firstName.trim()) {
    normalized.name = normalized.firstName.trim();
  }

  return normalized;
}

// ────────────────────────────────────────────────
// Email Sending
// ────────────────────────────────────────────────

/**
 * Sends emails to one or more recipients using a template or raw HTML content.
 * Creates one Email record per recipient.
 *
 * @param {object} emailData - Email data
 * @param {string[]} emailData.to_emails - Array of recipient email addresses
 * @param {string[]} [emailData.to_names] - Array of recipient names (parallel to to_emails)
 * @param {string} [emailData.type] - Email type (transactional, marketing, admin_broadcast)
 * @param {string} [emailData.subject] - Email subject (overrides template subject if provided)
 * @param {string} [emailData.template_name] - Template name to use
 * @param {object} [emailData.variables] - Variables for template rendering
 * @param {string} [emailData.html_body] - Raw HTML content (used if no template)
 * @param {string} [emailData.text_body] - Raw text content (used if no template)
 * @param {object} [emailData.meta] - Related entity metadata
 * @returns {Promise<object[]>} Array of created Email records
 */
async function sendEmail(emailData) {
  const {
    to_emails,
    to_names,
    type,
    subject,
    template_name,
    variables,
    html_body,
    text_body,
    meta,
  } = emailData;

  let finalSubject = subject || '';
  let finalHtml = html_body || '';
  let finalText = text_body || '';
  let resolvedTemplateName = null;
  let storedVariables = null;

  if (!Array.isArray(to_emails) || to_emails.length === 0) {
    throw AppError.badRequest('At least one recipient email is required');
  }

  // If a template name is provided, look up the template and render it
  if (template_name) {
    const templateCandidates = getTemplateNameCandidates(template_name);
    const emailTemplate = await EmailTemplate.findOne({
      where: {
        name: { [Op.in]: templateCandidates },
        is_active: true,
      },
      order: [['name', 'ASC']],
    });

    if (!emailTemplate) {
      throw AppError.notFound(`Email template '${template_name}' not found or is inactive`);
    }

    resolvedTemplateName = emailTemplate.name;
    storedVariables = normalizeTemplateVariables(variables);

    const rendered = renderEmailFromTemplate(emailTemplate, storedVariables);
    finalSubject = subject || rendered.subject;
    finalHtml = rendered.html;
    finalText = rendered.text || '';
  }

  const fromEmail = config.smtp.from.email;
  const fromName = config.smtp.from.name;

  const results = [];

  // Create one Email record per recipient and send
  for (let i = 0; i < to_emails.length; i++) {
    const toEmail = to_emails[i];
    const toName = to_names && to_names[i] ? to_names[i] : null;

    // Create the email record in DB with status 'pending'
    const emailRecord = await Email.create({
      id: generateUUID(),
      type: type || 'transactional',
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      to_name: toName,
      subject: finalSubject,
      html_body: finalHtml,
      text_body: finalText,
      template_name: resolvedTemplateName,
      variables: storedVariables,
      status: 'pending',
      retry_count: 0,
      meta: meta || null,
    });

    // Attempt to send via nodemailer
    try {
      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: toName ? `"${toName}" <${toEmail}>` : toEmail,
        subject: finalSubject,
      };

      if (finalHtml) {
        mailOptions.html = finalHtml;
      }
      if (finalText) {
        mailOptions.text = finalText;
      }

      const info = await transporter.sendMail(mailOptions);

      await emailRecord.update({
        status: 'sent',
        smtp_message_id: info.messageId || null,
        sent_at: new Date(),
      });

      await emailRecord.reload();
    } catch (err) {
      await emailRecord.update({
        status: 'failed',
        error_message: err.message || 'Unknown SMTP error',
        retry_count: emailRecord.retry_count + 1,
      });

      await emailRecord.reload();
      console.error(`[email-service] Failed to send email to ${toEmail}:`, err.message);
    }

    results.push(emailRecord);
  }

  return results;
}

// ────────────────────────────────────────────────
// Email Queries
// ────────────────────────────────────────────────

/**
 * Lists emails with pagination, status filter, and search.
 */
async function listEmails(filters) {
  const { page, limit, status, search } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.to_email = { [Op.like]: `%${search}%` };
  }

  const { rows: emails, count: total } = await Email.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { emails, meta };
}

/**
 * Gets a single email record by ID.
 */
async function getEmail(id) {
  const email = await Email.findByPk(id);

  if (!email) {
    throw AppError.notFound('Email not found');
  }

  return email;
}

/**
 * Retries a failed email. Only retries if status is 'failed' and retry_count < MAX_RETRIES.
 */
async function retryEmail(id) {
  const emailRecord = await Email.findByPk(id);

  if (!emailRecord) {
    throw AppError.notFound('Email not found');
  }

  if (emailRecord.status !== 'failed') {
    throw AppError.badRequest('Only failed emails can be retried');
  }

  if (emailRecord.retry_count >= MAX_RETRIES) {
    throw AppError.badRequest(
      `Maximum retry attempts (${MAX_RETRIES}) reached for this email`
    );
  }

  const fromName = config.smtp.from.name;

  // Attempt to resend
  try {
    const mailOptions = {
      from: `"${fromName}" <${emailRecord.from_email}>`,
      to: emailRecord.to_name
        ? `"${emailRecord.to_name}" <${emailRecord.to_email}>`
        : emailRecord.to_email,
      subject: emailRecord.subject,
    };

    if (emailRecord.html_body) {
      mailOptions.html = emailRecord.html_body;
    }
    if (emailRecord.text_body) {
      mailOptions.text = emailRecord.text_body;
    }

    const info = await transporter.sendMail(mailOptions);

    await emailRecord.update({
      status: 'sent',
      smtp_message_id: info.messageId || null,
      sent_at: new Date(),
      error_message: null,
    });

    await emailRecord.reload();
    return emailRecord;
  } catch (err) {
    await emailRecord.update({
      status: 'failed',
      error_message: err.message || 'Unknown SMTP error',
      retry_count: emailRecord.retry_count + 1,
    });

    await emailRecord.reload();
    console.error(`[email-service] Retry failed for email ${id}:`, err.message);
    return emailRecord;
  }
}

// ────────────────────────────────────────────────
// Template Management
// ────────────────────────────────────────────────

/**
 * Creates a new email template. Ensures name uniqueness.
 */
async function createTemplate(data) {
  const existing = await EmailTemplate.findOne({
    where: { name: data.name },
  });

  if (existing) {
    throw AppError.conflict(`Email template with name '${data.name}' already exists`);
  }

  const template = await EmailTemplate.create({
    id: generateUUID(),
    name: data.name,
    subject: data.subject,
    html_body: data.html_body,
    text_body: data.text_body || null,
    is_active: true,
  });

  return template;
}

/**
 * Lists email templates with pagination and optional is_active filter.
 */
async function listTemplates(filters) {
  const { page, limit, is_active } = filters;
  const { offset, limit: paginationLimit } = getPagination(page, limit);

  const where = {};

  if (is_active !== undefined) {
    where.is_active = is_active;
  }

  const { rows: templates, count: total } = await EmailTemplate.findAndCountAll({
    where,
    offset,
    limit: paginationLimit,
    order: [['created_at', 'DESC']],
  });

  const meta = getPaginationMeta(total, page, limit);

  return { templates, meta };
}

/**
 * Gets a single email template by ID.
 */
async function getTemplate(id) {
  const template = await EmailTemplate.findByPk(id);

  if (!template) {
    throw AppError.notFound('Email template not found');
  }

  return template;
}

/**
 * Gets a single email template by its unique name.
 */
async function getTemplateByName(name) {
  const template = await EmailTemplate.findOne({
    where: { name },
  });

  if (!template) {
    throw AppError.notFound(`Email template '${name}' not found`);
  }

  return template;
}

/**
 * Updates an email template.
 */
async function updateTemplate(id, data) {
  const template = await EmailTemplate.findByPk(id);

  if (!template) {
    throw AppError.notFound('Email template not found');
  }

  // If name is being changed, check for uniqueness
  if (data.name && data.name !== template.name) {
    const existing = await EmailTemplate.findOne({
      where: { name: data.name },
    });

    if (existing) {
      throw AppError.conflict(`Email template with name '${data.name}' already exists`);
    }
  }

  await template.update(data);
  await template.reload();

  return template;
}

/**
 * Hard-deletes an email template. Only deletes if not used in recent emails.
 */
async function deleteTemplate(id) {
  const template = await EmailTemplate.findByPk(id);

  if (!template) {
    throw AppError.notFound('Email template not found');
  }

  // Check if the template has been used in recent emails (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentUsageCount = await Email.count({
    where: {
      template_name: template.name,
      created_at: { [Op.gte]: thirtyDaysAgo },
    },
  });

  if (recentUsageCount > 0) {
    throw AppError.badRequest(
      `Cannot delete template '${template.name}' because it has been used in ${recentUsageCount} email(s) in the last 30 days. Deactivate it instead.`
    );
  }

  await template.destroy();

  return { id };
}

module.exports = {
  sendEmail,
  listEmails,
  getEmail,
  retryEmail,
  createTemplate,
  listTemplates,
  getTemplate,
  getTemplateByName,
  updateTemplate,
  deleteTemplate,
};
