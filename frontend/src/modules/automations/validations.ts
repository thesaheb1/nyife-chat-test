import { z } from 'zod/v4';

export const createAutomationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['basic_reply', 'advanced_flow', 'webhook_trigger', 'api_trigger']),
  wa_account_id: z.string().min(1, 'WhatsApp account is required'),
  priority: z.number().int().min(0).optional(),
});
export type CreateAutomationFormData = z.infer<typeof createAutomationSchema>;
