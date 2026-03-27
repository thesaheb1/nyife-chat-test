'use strict';

const { z } = require('zod');
const {
  FLOW_CATEGORIES,
  FLOW_COMPONENT_TYPES,
  FLOW_FOOTER_ACTION_TYPES,
} = require('../constants/flow.constants');

const SCREEN_ID_REGEX = /^[A-Z][A-Z0-9_]{1,79}$/;
const FIELD_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/;

const optionSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
}).passthrough();

const footerActionSchema = z.object({
  type: z.enum(FLOW_FOOTER_ACTION_TYPES),
  target_screen_id: z.string().optional(),
  payload: z.record(z.any()).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'navigate' && !value.target_screen_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Footer navigate actions require target_screen_id.',
      path: ['target_screen_id'],
    });
  }

  if (value.type === 'complete' && value.target_screen_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Footer complete actions cannot define target_screen_id.',
      path: ['target_screen_id'],
    });
  }
});

const componentSchema = z.object({
  type: z.enum(FLOW_COMPONENT_TYPES),
  name: z.string().regex(FIELD_NAME_REGEX).optional(),
  text: z.string().max(2000).optional(),
  label: z.string().max(120).optional(),
  helper_text: z.string().max(400).optional(),
  placeholder: z.string().max(120).optional(),
  required: z.boolean().optional(),
  min_length: z.number().int().min(0).max(2000).optional(),
  max_length: z.number().int().min(1).max(4000).optional(),
  default_value: z.any().optional(),
  options: z.array(optionSchema).optional(),
  min_selections: z.number().int().min(0).max(50).optional(),
  max_selections: z.number().int().min(1).max(50).optional(),
  image_url: z.string().url().optional(),
  caption: z.string().max(400).optional(),
  action: footerActionSchema.optional(),
  metadata: z.record(z.any()).optional(),
}).passthrough();

const screenSchema = z.object({
  id: z.string().regex(SCREEN_ID_REGEX),
  title: z.string().min(1).max(120),
  terminal: z.boolean().optional(),
  refresh_on_back: z.boolean().optional(),
  success_message: z.string().max(500).optional(),
  data_source: z.record(z.any()).optional(),
  layout: z.object({
    type: z.string().default('SingleColumnLayout'),
    children: z.array(componentSchema).default([]),
  }),
}).passthrough();

const flowDefinitionSchema = z.object({
  version: z.string().min(1).max(20).default('7.1'),
  data_api_version: z.string().min(1).max(20).optional(),
  routing_model: z.record(z.array(z.string())).optional(),
  screens: z.array(screenSchema).min(1),
}).superRefine((value, ctx) => {
  const screenIds = new Set();
  const fieldNames = new Set();

  value.screens.forEach((screen, screenIndex) => {
    if (screenIds.has(screen.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate screen id "${screen.id}".`,
        path: ['screens', screenIndex, 'id'],
      });
    }
    screenIds.add(screen.id);

    screen.layout.children.forEach((component, componentIndex) => {
      if (component.name) {
        if (fieldNames.has(component.name)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate field name "${component.name}".`,
            path: ['screens', screenIndex, 'layout', 'children', componentIndex, 'name'],
          });
        }
        fieldNames.add(component.name);
      }

      if (component.type === 'Footer' && component.action?.type === 'navigate') {
        const target = component.action.target_screen_id;
        if (target && !value.screens.some((candidate) => candidate.id === target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Footer target screen "${target}" does not exist.`,
            path: ['screens', screenIndex, 'layout', 'children', componentIndex, 'action', 'target_screen_id'],
          });
        }
      }
    });
  });
});

function createDefaultFlowDefinition(name) {
  const safeBase = String(name || 'Flow')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  const startId = `${safeBase || 'FLOW'}_START`.slice(0, 80);

  return {
    version: '7.1',
    data_api_version: '3.0',
    routing_model: {
      START: [startId],
    },
    screens: [
      {
        id: startId,
        title: name || 'Flow Start',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'TextHeading',
              text: name || 'Flow Start',
            },
            {
              type: 'TextBody',
              text: 'Build your WhatsApp flow here.',
            },
            {
              type: 'Footer',
              label: 'Submit',
              action: {
                type: 'complete',
              },
            },
          ],
        },
      },
    ],
  };
}

function extractValidationErrors(error) {
  if (!error || !Array.isArray(error.errors)) {
    return ['Invalid flow definition.'];
  }

  return error.errors.map((issue) => {
    const path = Array.isArray(issue.path) && issue.path.length > 0
      ? `${issue.path.join('.')}: `
      : '';
    return `${path}${issue.message}`;
  });
}

function validateFlowDefinition(definition) {
  const parsed = flowDefinitionSchema.safeParse(definition);
  if (!parsed.success) {
    return {
      valid: false,
      normalized: null,
      validationErrors: extractValidationErrors(parsed.error),
    };
  }

  return {
    valid: true,
    normalized: parsed.data,
    validationErrors: [],
  };
}

module.exports = {
  FLOW_CATEGORIES,
  SCREEN_ID_REGEX,
  FIELD_NAME_REGEX,
  flowDefinitionSchema,
  createDefaultFlowDefinition,
  validateFlowDefinition,
};
