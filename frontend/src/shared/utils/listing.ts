import type { DateRangeValue } from './dateRange';

type QueryValue = string | number | boolean | null | undefined;

export function buildListQuery<T extends object>(
  params: T,
  options: {
    transformDateRange?: boolean;
  } = {}
) {
  const query = new URLSearchParams();

  Object.entries(params as Record<string, QueryValue>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (options.transformDateRange && (key === 'date_from' || key === 'date_to')) {
      query.set(key, String(value));
      return;
    }

    query.set(key, String(value));
  });

  const value = query.toString();
  return value ? `?${value}` : '';
}

export function hasActiveDateRange(range: DateRangeValue) {
  return Boolean(range.from || range.to);
}
