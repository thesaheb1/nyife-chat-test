import { z } from 'zod/v4';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createCampaignSchema = z
  .object({
    name: z.string().min(1, 'Campaign name is required').max(255),
    description: z.string().max(5000).optional(),
    wa_account_id: z.string().regex(uuidRegex, 'Invalid WhatsApp account'),
    template_id: z.string().regex(uuidRegex, 'Invalid template'),
    type: z.enum(['immediate', 'scheduled']),
    target_type: z.enum(['group', 'contacts', 'tags', 'all']),
    target_config: z.object({
      group_ids: z.array(z.string()).optional(),
      contact_ids: z.array(z.string()).optional(),
      tag_ids: z.array(z.string()).optional(),
      exclude_tag_ids: z.array(z.string()).optional(),
    }),
    variables_mapping: z.record(z.string(), z.string()).optional(),
    scheduled_at: z.string().optional(),
  })
  .refine(
    (d) => d.type !== 'scheduled' || (d.scheduled_at && d.scheduled_at.length > 0),
    { message: 'Scheduled date is required for scheduled campaigns', path: ['scheduled_at'] }
  );

export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  wa_account_id: z.string().regex(uuidRegex).optional(),
  template_id: z.string().regex(uuidRegex).optional(),
  type: z.enum(['immediate', 'scheduled']).optional(),
  target_type: z.enum(['group', 'contacts', 'tags', 'all']).optional(),
  target_config: z
    .object({
      group_ids: z.array(z.string()).optional(),
      contact_ids: z.array(z.string()).optional(),
      tag_ids: z.array(z.string()).optional(),
      exclude_tag_ids: z.array(z.string()).optional(),
    })
    .optional(),
  variables_mapping: z.record(z.string(), z.string()).optional(),
  scheduled_at: z.string().optional(),
});
export type UpdateCampaignFormData = z.infer<typeof updateCampaignSchema>;
