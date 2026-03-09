import PhoneInput, { type Country } from 'react-phone-number-input';
import { cn } from '@/lib/utils';

interface PhoneNumberInputProps {
  value?: string | null;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  defaultCountry?: Country;
  onBlur?: () => void;
  className?: string;
  inputClassName?: string;
  invalid?: boolean;
}

export function PhoneNumberInput({
  value,
  onChange,
  id,
  name,
  placeholder = 'Enter phone number',
  disabled,
  required,
  autoComplete,
  defaultCountry = 'IN',
  onBlur,
  className,
  inputClassName,
  invalid = false,
}: PhoneNumberInputProps) {
  return (
    <PhoneInput
      value={value || undefined}
      onChange={(next) => onChange(next || '')}
      defaultCountry={defaultCountry}
      countryCallingCodeEditable={false}
      placeholder={placeholder}
      disabled={disabled}
      className={cn('nyife-phone-input', invalid && 'nyife-phone-input--invalid', className)}
      numberInputProps={{
        id,
        name,
        required,
        disabled,
        autoComplete,
        onBlur,
        className: cn('nyife-phone-input__field', inputClassName),
        'aria-invalid': invalid || undefined,
      }}
      countrySelectProps={{
        'aria-label': 'Select country code',
      }}
    />
  );
}
