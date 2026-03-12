import { useState } from 'react';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DATE_RANGE_PRESETS,
  formatDateInputValue,
  getDateRangeLabel,
  getPresetDateRange,
  parseDateValue,
  type DateRangeValue,
} from '@/shared/utils/dateRange';

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
}

function toCalendarRange(value: DateRangeValue): DateRange | undefined {
  const from = parseDateValue(value.from);
  const to = parseDateValue(value.to);

  if (!from && !to) {
    return undefined;
  }

  return { from, to };
}

function toRangeValue(range?: DateRange): DateRangeValue {
  return {
    from: range?.from ? formatDateInputValue(range.from) : undefined,
    to: range?.to ? formatDateInputValue(range.to) : undefined,
  };
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (range?: DateRange) => {
    const nextValue = toRangeValue(range);
    onChange(nextValue);

    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  const handlePreset = (presetKey: (typeof DATE_RANGE_PRESETS)[number]['key']) => {
    onChange(getPresetDateRange(presetKey));
    setOpen(false);
  };

  const clearFilter = () => {
    onChange({});
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left sm:w-[280px]">
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{getDateRangeLabel(value, 'Select date range')}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-4 p-4">
          <PopoverHeader className="gap-0">
            <PopoverTitle>Date range</PopoverTitle>
            <PopoverDescription>
              Use a preset or pick a custom range from the calendar.
            </PopoverDescription>
          </PopoverHeader>

          <div className="grid grid-cols-2 gap-2">
            {DATE_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="rounded-lg border">
            <Calendar
              mode="range"
              defaultMonth={parseDateValue(value.from) || new Date()}
              selected={toCalendarRange(value)}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {value.from || value.to
                ? getDateRangeLabel(value)
                : 'No range selected'}
            </div>

            {(value.from || value.to) ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilter}>
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
