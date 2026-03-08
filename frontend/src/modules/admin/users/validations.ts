import { z } from 'zod/v4';
import { optionalPhoneSchema } from '@/shared/utils/phone';

export const createUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.email('Invalid email address'),
  phone: optionalPhoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['user', 'admin']),
  status: z.enum(['active', 'inactive', 'suspended']),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const walletActionSchema = z.object({
  amount: z.number().min(1, 'Amount must be at least 1'),
  remarks: z.string().min(1, 'Remarks are required').max(500),
});

export type WalletActionFormData = z.infer<typeof walletActionSchema>;
