import {
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

export interface DateRangeValue {
  from?: string;
  to?: string;
}

export type DateRangePresetKey =
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'last30Days'
  | 'lastMonth'
  | 'lastYear';

export interface DateRangePreset {
  key: DateRangePresetKey;
  label: string;
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7Days', label: 'Last 7 Days' },
  { key: 'last30Days', label: 'Last 30 Days' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'lastYear', label: 'Last Year' },
];

export function formatDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateValue(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function formatDateValueForDisplay(value?: string) {
  const parsed = parseDateValue(value);
  return parsed ? format(parsed, 'MMM d, yyyy') : '';
}

export function getPresetDateRange(
  preset: DateRangePresetKey,
  now: Date = new Date()
): DateRangeValue {
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return {
        from: formatDateInputValue(today),
        to: formatDateInputValue(today),
      };
    case 'yesterday': {
      const yesterday = subDays(today, 1);
      return {
        from: formatDateInputValue(yesterday),
        to: formatDateInputValue(yesterday),
      };
    }
    case 'last7Days':
      return {
        from: formatDateInputValue(subDays(today, 6)),
        to: formatDateInputValue(today),
      };
    case 'last30Days':
      return {
        from: formatDateInputValue(subDays(today, 29)),
        to: formatDateInputValue(today),
      };
    case 'lastMonth': {
      const previousMonth = subMonths(today, 1);
      return {
        from: formatDateInputValue(startOfMonth(previousMonth)),
        to: formatDateInputValue(endOfMonth(previousMonth)),
      };
    }
    case 'lastYear': {
      const previousYear = subYears(today, 1);
      return {
        from: formatDateInputValue(startOfYear(previousYear)),
        to: formatDateInputValue(endOfYear(previousYear)),
      };
    }
    default:
      return {};
  }
}

export function findMatchingDatePreset(range: DateRangeValue) {
  if (!range.from || !range.to) {
    return null;
  }

  return DATE_RANGE_PRESETS.find((preset) => {
    const presetRange = getPresetDateRange(preset.key);
    return presetRange.from === range.from && presetRange.to === range.to;
  }) || null;
}

export function getDateRangeLabel(
  range: DateRangeValue,
  placeholder = 'Select date range'
) {
  const matchedPreset = findMatchingDatePreset(range);
  if (matchedPreset) {
    return matchedPreset.label;
  }

  if (range.from && range.to) {
    if (range.from === range.to) {
      return formatDateValueForDisplay(range.from);
    }

    return `${formatDateValueForDisplay(range.from)} - ${formatDateValueForDisplay(range.to)}`;
  }

  if (range.from) {
    return `${formatDateValueForDisplay(range.from)} onward`;
  }

  if (range.to) {
    return `Until ${formatDateValueForDisplay(range.to)}`;
  }

  return placeholder;
}
