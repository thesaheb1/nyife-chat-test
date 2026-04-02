import { z } from 'zod/v4';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const variableBindingSchema = z.union([
  z.string(),
  z.object({
    mode: z.literal('static'),
    value: z.string(),
  }),
  z.object({
    mode: z.literal('dynamic'),
    source: z.enum(['full_name', 'email', 'phone']),
  }),
]);

const campaignMediaBindingSchema = z.object({
  file_id: z.string().regex(uuidRegex, 'Invalid media file'),
  media_type: z.enum(['image', 'video', 'document']),
  original_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  preview_url: z.string().trim().optional(),
});

const campaignLocationBindingSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  name: z.string().trim().max(255).optional(),
  address: z.string().trim().max(500).optional(),
});

const campaignProductBindingSchema = z.object({
  product_retailer_id: z.string().trim().min(1).max(255),
});

const templateBindingsSchema = z.object({
  variables: z.record(z.string(), variableBindingSchema).optional(),
  media: z.record(z.string(), campaignMediaBindingSchema).optional(),
  locations: z.record(z.string(), campaignLocationBindingSchema).optional(),
  products: z.record(z.string(), campaignProductBindingSchema).optional(),
});

const targetConfigSchema = z.object({
  group_ids: z.array(z.string()).optional(),
  contact_ids: z.array(z.string()).optional(),
  tag_ids: z.array(z.string()).optional(),
  exclude_contact_ids: z.array(z.string()).optional(),
  exclude_tag_ids: z.array(z.string()).optional(),
});

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, 'Campaign name is required').max(255),
    description: z.string().trim().max(5000).optional().or(z.literal('')),
    wa_account_id: z.string().regex(uuidRegex, 'Select a valid phone number'),
    template_id: z.string().regex(uuidRegex, 'Invalid template'),
    type: z.enum(['immediate', 'scheduled']),
    target_type: z.enum(['group', 'contacts', 'tags', 'all']),
    target_config: targetConfigSchema,
    variables_mapping: z.record(z.string(), variableBindingSchema).optional(),
    template_bindings: templateBindingsSchema.optional(),
    scheduled_at: z.string().trim().optional(),
  })
  .refine(
    (d) => d.type !== 'scheduled' || (d.scheduled_at && d.scheduled_at.length > 0),
    { message: 'Scheduled date is required for scheduled campaigns', path: ['scheduled_at'] }
  )
  .superRefine((data, ctx) => {
    if (data.target_type === 'contacts' && !(data.target_config.contact_ids || []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one contact.',
        path: ['target_config', 'contact_ids'],
      });
    }

    if (data.target_type === 'group' && !(data.target_config.group_ids || []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one group.',
        path: ['target_config', 'group_ids'],
      });
    }

    if (data.target_type === 'tags' && !(data.target_config.tag_ids || []).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one tag.',
        path: ['target_config', 'tag_ids'],
      });
    }
  });

export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  wa_account_id: z.string().regex(uuidRegex, 'Select a valid phone number').optional(),
  template_id: z.string().regex(uuidRegex).optional(),
  type: z.enum(['immediate', 'scheduled']).optional(),
  target_type: z.enum(['group', 'contacts', 'tags', 'all']).optional(),
  target_config: targetConfigSchema.optional(),
  variables_mapping: z.record(z.string(), variableBindingSchema).optional(),
  template_bindings: templateBindingsSchema.optional().nullable(),
  scheduled_at: z.string().trim().optional(),
});
export type UpdateCampaignFormData = z.infer<typeof updateCampaignSchema>;
