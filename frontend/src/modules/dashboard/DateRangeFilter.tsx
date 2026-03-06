import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DateRangeFilterProps {
  value: { from?: string; to?: string };
  onChange: (range: { from?: string; to?: string }) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const presets = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
  ];

  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    });
  };

  const clearFilter = () => {
    onChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.label}
          variant="outline"
          size="sm"
          onClick={() => setPreset(p.days)}
          className="text-xs"
        >
          {p.label}
        </Button>
      ))}
      <Input
        type="date"
        value={value.from ?? ''}
        onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        className="h-8 w-auto text-xs"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={value.to ?? ''}
        onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        className="h-8 w-auto text-xs"
      />
      {(value.from || value.to) && (
        <Button variant="ghost" size="sm" onClick={clearFilter} className="text-xs">
          Clear
        </Button>
      )}
    </div>
  );
}
