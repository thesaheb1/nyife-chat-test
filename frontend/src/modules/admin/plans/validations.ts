import { z } from 'zod/v4';
import { isValidRupeeAmount } from '@/shared/utils';

function nonNegativeRupeeAmountSchema(label: string) {
  return z
    .number()
    .finite(`${label} must be a valid number`)
    .min(0, `${label} must be 0 or more`)
    .refine((value) => isValidRupeeAmount(value, { allowZero: true }), {
      message: `${label} can have at most 2 decimal places`,
    });
}

function positiveRupeeAmountSchema(label: string) {
  return z
    .number()
    .finite(`${label} must be a valid number`)
    .positive(`${label} must be greater than 0`)
    .refine((value) => isValidRupeeAmount(value, { allowZero: false }), {
      message: `${label} can have at most 2 decimal places`,
    });
}

export const createPlanSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  type: z.enum(['monthly', 'yearly', 'lifetime']),
  price: nonNegativeRupeeAmountSchema('Price'),
  currency: z.string().trim().optional().or(z.literal('')),
  max_contacts: z.number().int().min(1),
  max_templates: z.number().int().min(1),
  max_campaigns_per_month: z.number().int().min(1),
  max_messages_per_month: z.number().int().min(1),
  max_team_members: z.number().int().min(1),
  max_organizations: z.number().int().min(1),
  max_whatsapp_numbers: z.number().int().min(1),
  has_priority_support: z.boolean().optional(),
  marketing_message_price: nonNegativeRupeeAmountSchema('Marketing message price'),
  utility_message_price: nonNegativeRupeeAmountSchema('Utility message price'),
  auth_message_price: nonNegativeRupeeAmountSchema('Authentication message price'),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

export type CreatePlanFormData = z.infer<typeof createPlanSchema>;

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(1, 'Coupon code is required').max(50),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    discount_type: z.enum(['percentage', 'fixed']),
    discount_value: z.number().finite('Discount value must be a valid number'),
    max_uses: z.number().int().min(1).nullable().optional(),
    min_plan_price: nonNegativeRupeeAmountSchema('Minimum plan price').nullable().optional(),
    valid_from: z.string().min(1, 'Valid from is required'),
    valid_until: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discount_type === 'percentage') {
      if (!Number.isInteger(data.discount_value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_value'],
          message: 'Percentage discount must be a whole number',
        });
      } else if (data.discount_value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discount_value'],
          message: 'Percentage discount cannot exceed 100',
        });
      }
    } else if (data.discount_value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discount_value'],
        message: 'Discount amount must be greater than 0',
      });
    } else if (!positiveRupeeAmountSchema('Discount amount').safeParse(data.discount_value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discount_value'],
        message: 'Discount amount can have at most 2 decimal places',
      });
    }

    if (data.valid_until && new Date(data.valid_until) < new Date(data.valid_from)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valid_until'],
        message: 'Valid until must be after valid from',
      });
    }
  });

export type CreateCouponFormData = z.infer<typeof createCouponSchema>;
