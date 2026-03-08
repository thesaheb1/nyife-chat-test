import { isValidPhoneNumber } from 'react-phone-number-input';
import { z } from 'zod/v4';

export const PHONE_VALIDATION_MESSAGE = 'Enter a valid international phone number.';

function hasPhoneValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export const requiredPhoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .refine((value) => isValidPhoneNumber(value), PHONE_VALIDATION_MESSAGE);

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(
    (value) => !hasPhoneValue(value) || (typeof value === 'string' && isValidPhoneNumber(value)),
    PHONE_VALIDATION_MESSAGE
  );
