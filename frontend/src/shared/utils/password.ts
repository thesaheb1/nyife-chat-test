import { z } from 'zod/v4';

export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]).{8,}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character';

export const strongPasswordSchema = z.string().regex(PASSWORD_REGEX, PASSWORD_POLICY_MESSAGE);

export const PASSWORD_REQUIREMENTS = [
  {
    key: 'length',
    label: 'At least 8 characters',
    test: (password: string) => password.length >= 8,
  },
  {
    key: 'uppercase',
    label: 'One uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: 'lowercase',
    label: 'One lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    key: 'number',
    label: 'One number',
    test: (password: string) => /\d/.test(password),
  },
  {
    key: 'special',
    label: 'One special character',
    test: (password: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
  },
] as const;

export function getPasswordChecks(password: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    met: requirement.test(password),
  }));
}

export function getPasswordStrength(password: string) {
  const checks = getPasswordChecks(password);
  const score = checks.filter((check) => check.met).length;
  const percentage = Math.round((score / checks.length) * 100);
  const isValid = score === checks.length;

  let label = 'Start typing';
  if (password.length > 0 && score <= 1) {
    label = 'Too weak';
  } else if (score === 2) {
    label = 'Weak';
  } else if (score === 3) {
    label = 'Fair';
  } else if (score === 4) {
    label = 'Good';
  } else if (score === 5) {
    label = 'Strong';
  }

  return {
    checks,
    score,
    percentage,
    isValid,
    label,
  };
}

export function isStrongPassword(password: string) {
  return PASSWORD_REGEX.test(password);
}
