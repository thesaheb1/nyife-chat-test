import { z } from 'zod/v4';
import { isValidRupeeAmount } from '@/shared/utils';
import { optionalPhoneSchema } from '@/shared/utils/phone';
import { strongPasswordSchema } from '@/shared/utils/password';

export const directCreateUserSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address'),
  phone: optionalPhoneSchema,
  password: strongPasswordSchema,
});

export const inviteUserSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address'),
  phone: optionalPhoneSchema,
});

export const updateUserSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid email address'),
  phone: optionalPhoneSchema,
});

export const acceptUserInvitationSchema = z.object({
  password: strongPasswordSchema,
});

export type CreateUserFormData = z.infer<typeof directCreateUserSchema>;
export type InviteUserFormData = z.infer<typeof inviteUserSchema>;
export type UpdateUserFormData = z.infer<typeof updateUserSchema>;
export type AcceptUserInvitationFormData = z.infer<typeof acceptUserInvitationSchema>;

export const walletActionSchema = z.object({
  amount: z
    .number()
    .finite('Amount must be a valid number')
    .positive('Amount must be greater than 0')
    .refine((value) => isValidRupeeAmount(value, { allowZero: false }), {
      message: 'Amount can have at most 2 decimal places',
    }),
  remarks: z.string().trim().min(1, 'Remarks are required').max(500),
});

export type WalletActionFormData = z.infer<typeof walletActionSchema>;
