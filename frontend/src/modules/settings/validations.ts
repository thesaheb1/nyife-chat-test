import { z } from 'zod/v4';
import { optionalPhoneSchema } from '@/shared/utils/phone';

export const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  phone: optionalPhoneSchema,
});
export type ProfileFormData = z.infer<typeof profileSchema>;

export const preferencesSchema = z.object({
  language: z.string().min(1).max(10),
  timezone: z.string().min(1).max(100),
});
export type PreferencesFormData = z.infer<typeof preferencesSchema>;

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Confirmation is required'),
}).refine((d) => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
