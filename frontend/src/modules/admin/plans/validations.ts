import { z } from 'zod/v4';

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['monthly', 'yearly', 'lifetime']),
  price: z.number().min(0, 'Price must be 0 or more'),
  currency: z.string().optional(),
  max_contacts: z.number().int().min(1),
  max_templates: z.number().int().min(1),
  max_campaigns_per_month: z.number().int().min(1),
  max_messages_per_month: z.number().int().min(1),
  max_team_members: z.number().int().min(1),
  max_whatsapp_numbers: z.number().int().min(1),
  has_priority_support: z.boolean().optional(),
  marketing_message_price: z.number().min(0),
  utility_message_price: z.number().min(0),
  auth_message_price: z.number().min(0),
  service_message_price: z.number().min(0),
  referral_conversion_message_price: z.number().min(0),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export type CreatePlanFormData = z.infer<typeof createPlanSchema>;

export const createCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required').max(50),
  description: z.string().max(500).optional(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().min(1, 'Discount value must be at least 1'),
  max_uses: z.number().int().min(1).optional(),
  valid_from: z.string().min(1, 'Valid from is required'),
  valid_until: z.string().optional(),
  is_active: z.boolean().optional(),
});

export type CreateCouponFormData = z.infer<typeof createCouponSchema>;
