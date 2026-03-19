import { cn } from '@/lib/utils';
import { getPasswordStrength } from '@/shared/utils/password';

type PasswordStrengthMeterProps = {
  password: string;
  className?: string;
};

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const strength = getPasswordStrength(password);

  const toneClassName =
    strength.score <= 1
      ? 'bg-destructive'
      : strength.score === 2
        ? 'bg-orange-500'
        : strength.score === 3
          ? 'bg-amber-500'
          : strength.score === 4
            ? 'bg-lime-600'
            : 'bg-emerald-600';

  const textClassName =
    strength.score <= 1
      ? 'text-destructive'
      : strength.score === 2
        ? 'text-orange-600'
        : strength.score === 3
          ? 'text-amber-600'
          : strength.score === 4
            ? 'text-lime-700'
            : 'text-emerald-700';

  return (
    <div className={cn('space-y-2 rounded-md border bg-muted/20 p-3', className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">Password strength</span>
        <span aria-live="polite" className={cn('font-medium', textClassName)}>
          {strength.label}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-200 ease-out', toneClassName)}
          style={{ width: `${strength.percentage}%` }}
        />
      </div>
      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {strength.checks.map((check) => (
          <p key={check.key} className={check.met ? 'text-foreground' : undefined}>
            {check.met ? 'Passed' : 'Needed'}: {check.label}
          </p>
        ))}
      </div>
    </div>
  );
}
