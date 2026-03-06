import { z } from 'zod/v4';

const buttonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'OTP', 'FLOW', 'CATALOG', 'MPM', 'COPY_CODE']),
  text: z.string().max(200).optional(),
  url: z.string().url().optional(),
  phone_number: z.string().optional(),
  example: z.union([z.string(), z.array(z.string())]).optional(),
  flow_id: z.string().optional(),
  flow_name: z.string().optional(),
  flow_action: z.string().optional(),
  flow_json: z.string().optional(),
  navigate_screen: z.string().optional(),
  otp_type: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']).optional(),
  autofill_text: z.string().optional(),
  package_name: z.string().optional(),
  signature_hash: z.string().optional(),
});

const componentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS', 'CAROUSEL', 'LIMITED_TIME_OFFER']),
  format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']).optional(),
  text: z.string().optional(),
  example: z.object({
    header_text: z.array(z.string()).optional(),
    body_text: z.array(z.array(z.string())).optional(),
    header_handle: z.array(z.string()).optional(),
  }).optional(),
  buttons: z.array(buttonSchema).optional(),
  add_security_recommendation: z.boolean().optional(),
  code_expiration_minutes: z.number().int().min(1).max(90).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(512).regex(/^[a-z][a-z0-9_]*$/, 'Lowercase letters, numbers and underscores only. Must start with a letter.'),
  display_name: z.string().max(512).optional(),
  language: z.string().min(2).max(20).optional(),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  type: z.enum(['standard', 'authentication', 'carousel', 'flow', 'list_menu']),
  components: z.array(componentSchema).min(1, 'At least one component is required'),
  example_values: z.record(z.string(), z.unknown()).optional(),
  waba_id: z.string().max(100).optional(),
});
export type CreateTemplateFormData = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateFormData = z.infer<typeof updateTemplateSchema>;

export const publishTemplateSchema = z.object({
  waba_id: z.string().min(1, 'WABA ID is required').max(100),
});
export type PublishTemplateFormData = z.infer<typeof publishTemplateSchema>;

export const syncTemplatesSchema = z.object({
  waba_id: z.string().min(1, 'WABA ID is required').max(100),
});
export type SyncTemplatesFormData = z.infer<typeof syncTemplatesSchema>;
