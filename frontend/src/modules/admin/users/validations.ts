import { z } from 'zod/v4';
import { optionalPhoneSchema } from '@/shared/utils/phone';

export const directCreateUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Invalid email address'),
  phone: optionalPhoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const inviteUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Invalid email address'),
  phone: optionalPhoneSchema,
});

export const updateUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Invalid email address'),
  phone: optionalPhoneSchema,
});

export const acceptUserInvitationSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateUserFormData = z.infer<typeof directCreateUserSchema>;
export type InviteUserFormData = z.infer<typeof inviteUserSchema>;
export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
export type AcceptUserInvitationFormData = z.infer<typeof acceptUserInvitationSchema>;

export const walletActionSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least 1'),
  remarks: z.string().min(1, 'Remarks are required').max(500),
});

export type WalletActionFormData = z.infer<typeof walletActionSchema>;
