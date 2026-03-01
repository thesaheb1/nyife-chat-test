'use strict';

const { z } = require('zod');

/**
 * Schema for sending an email.
 * Accepts an array of recipients. Must provide either a template_name or html_body.
 */
const sendEmailSchema = z
  .object({
    to_emails: z.array(z.string().email('Invalid email address')).min(1, 'At least one email is required'),
    to_names: z.array(z.string()).optional(),
    type: z.enum(['transactional', 'marketing', 'admin_broadcast']).default('transactional'),
    subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be at most 500 characters').optional(),
    template_name: z.string().min(1).max(255).optional(),
    variables: z.record(z.any()).optional(),
    html_body: z.string().min(1).optional(),
    text_body: z.string().min(1).optional(),
    meta: z.record(z.any()).optional(),
  })
  .refine((data) => data.template_name || data.html_body, {
    message: 'Either template_name or html_body must be provided',
  });

/**
 * Schema for listing emails with pagination and filters.
 */
const listEmailsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'sent', 'failed', 'bounced']).optional(),
  search: z.string().max(255).optional(),
});

/**
 * Schema for email ID parameter.
 */
const emailIdSchema = z.object({
  id: z.string().uuid('Invalid email ID'),
});

/**
 * Schema for creating an email template.
 */
const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(255, 'Template name must be at most 255 characters')
    .regex(/^[a-z0-9_]+$/, 'Template name must contain only lowercase letters, numbers, and underscores'),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be at most 500 characters'),
  html_body: z.string().min(1, 'HTML body is required'),
  text_body: z.string().optional(),
});

/**
 * Schema for updating an email template. All fields optional, but at least one required.
 */
const updateTemplateSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[a-z0-9_]+$/, 'Template name must contain only lowercase letters, numbers, and underscores')
      .optional(),
    subject: z.string().min(1).max(500).optional(),
    html_body: z.string().min(1).optional(),
    text_body: z.string().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/**
 * Schema for template ID parameter.
 */
const templateIdSchema = z.object({
  id: z.string().uuid('Invalid template ID'),
});

/**
 * Schema for listing templates with pagination and filters.
 */
const listTemplatesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_active: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

module.exports = {
  sendEmailSchema,
  listEmailsSchema,
  emailIdSchema,
  createTemplateSchema,
  updateTemplateSchema,
  templateIdSchema,
  listTemplatesSchema,
};
