import { z } from 'zod/v4';
import { optionalPhoneSchema, requiredPhoneSchema } from '@/shared/utils/phone';

export const createContactSchema = z.object({
  phone: requiredPhoneSchema,
  name: z.string().trim().max(200).optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').max(255).optional().or(z.literal('')),
  company: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
});
export type CreateContactFormData = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  phone: optionalPhoneSchema,
  name: z.string().trim().max(200).nullable().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').max(255).nullable().optional().or(z.literal('')),
  company: z.string().trim().max(200).nullable().optional().or(z.literal('')),
  notes: z.string().trim().max(5000).nullable().optional().or(z.literal('')),
  custom_fields: z.record(z.string(), z.unknown()).nullable().optional(),
  opted_in: z.boolean().optional(),
});
export type UpdateContactFormData = z.infer<typeof updateContactSchema>;

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color').optional(),
});
export type CreateTagFormData = z.infer<typeof createTagSchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  type: z.enum(['static', 'dynamic']).optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
});
export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
