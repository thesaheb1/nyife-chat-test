import { z } from 'zod/v4';
import { optionalPhoneSchema, requiredPhoneSchema } from '@/shared/utils/phone';

export const createContactSchema = z.object({
  phone: requiredPhoneSchema,
  name: z.string().max(200).optional(),
  email: z.email().max(255).optional().or(z.literal('')),
  company: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
});
export type CreateContactFormData = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  phone: optionalPhoneSchema,
  name: z.string().max(200).nullable().optional(),
  email: z.email().max(255).nullable().optional().or(z.literal('')),
  company: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
  opted_in: z.boolean().optional(),
});
export type UpdateContactFormData = z.infer<typeof updateContactSchema>;

export const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color').optional(),
});
export type CreateTagFormData = z.infer<typeof createTagSchema>;

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['static', 'dynamic']).optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
});
export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
