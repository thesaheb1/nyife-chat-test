import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/core/hooks';
import type { DateRangeValue } from '@/shared/utils/dateRange';
import { hasActiveDateRange } from '@/shared/utils/listing';

type ListingFilterValue = string;
type ListingFilters = Record<string, ListingFilterValue>;

interface UseListingStateOptions<TFilters extends ListingFilters> {
  initialFilters: TFilters;
  initialSearch?: string;
  initialPage?: number;
  initialDateRange?: DateRangeValue;
  debounceMs?: number;
  syncToUrl?: boolean;
  namespace?: string;
}

function toNamespacedKey(namespace: string | undefined, key: string) {
  return namespace ? `${namespace}_${key}` : key;
}

function readFiltersFromSearchParams<TFilters extends ListingFilters>(
  searchParams: URLSearchParams,
  namespace: string | undefined,
  initialFilters: TFilters
) {
  const next = { ...initialFilters };

  Object.keys(initialFilters).forEach((key) => {
    const paramValue = searchParams.get(toNamespacedKey(namespace, key));
    if (paramValue !== null) {
      next[key as keyof TFilters] = paramValue as TFilters[keyof TFilters];
    }
  });

  return next;
}

export function useListingState<TFilters extends ListingFilters>({
  initialFilters,
  initialSearch = '',
  initialPage = 1,
  initialDateRange = {},
  debounceMs = 300,
  syncToUrl = false,
  namespace,
}: UseListingStateOptions<TFilters>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPageState] = useState(() => {
    if (!syncToUrl) {
      return initialPage;
    }

    const parsed = Number(searchParams.get(toNamespacedKey(namespace, 'page')) || initialPage);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : initialPage;
  });
  const [search, setSearchState] = useState(() =>
    syncToUrl ? (searchParams.get(toNamespacedKey(namespace, 'search')) ?? initialSearch) : initialSearch
  );
  const [filters, setFilters] = useState<TFilters>(() =>
    syncToUrl
      ? readFiltersFromSearchParams(searchParams, namespace, initialFilters)
      : initialFilters
  );
  const [dateRange, setDateRangeState] = useState<DateRangeValue>(() => {
    if (!syncToUrl) {
      return initialDateRange;
    }

    return {
      from: searchParams.get(toNamespacedKey(namespace, 'date_from')) ?? initialDateRange.from,
      to: searchParams.get(toNamespacedKey(namespace, 'date_to')) ?? initialDateRange.to,
    };
  });

  const debouncedSearch = useDebounce(search, debounceMs);

  useEffect(() => {
    if (!syncToUrl) {
      return;
    }

    setSearchParams((currentParams) => {
      const next = new URLSearchParams(currentParams);
      const pageKey = toNamespacedKey(namespace, 'page');
      const searchKey = toNamespacedKey(namespace, 'search');
      const fromKey = toNamespacedKey(namespace, 'date_from');
      const toKey = toNamespacedKey(namespace, 'date_to');

      if (page > 1) {
        next.set(pageKey, String(page));
      } else {
        next.delete(pageKey);
      }

      if (search.trim()) {
        next.set(searchKey, search.trim());
      } else {
        next.delete(searchKey);
      }

      if (dateRange.from) {
        next.set(fromKey, dateRange.from);
      } else {
        next.delete(fromKey);
      }

      if (dateRange.to) {
        next.set(toKey, dateRange.to);
      } else {
        next.delete(toKey);
      }

      Object.entries(filters).forEach(([key, value]) => {
        const paramKey = toNamespacedKey(namespace, key);
        if (value) {
          next.set(paramKey, value);
        } else {
          next.delete(paramKey);
        }
      });

      return next;
    }, { replace: true });
  }, [dateRange.from, dateRange.to, filters, namespace, page, search, setSearchParams, syncToUrl]);

  const setPage = (nextPage: number) => {
    setPageState(nextPage);
  };

  const setSearch = (value: string) => {
    setSearchState(value);
    setPageState(1);
  };

  const setFilter = <TKey extends keyof TFilters>(key: TKey, value: TFilters[TKey]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setPageState(1);
  };

  const updateFilters = (updater: Partial<TFilters>) => {
    setFilters((current) => ({
      ...current,
      ...updater,
    }));
    setPageState(1);
  };

  const setDateRange = (value: DateRangeValue) => {
    setDateRangeState(value);
    setPageState(1);
  };

  const resetAll = () => {
    setPageState(initialPage);
    setSearchState(initialSearch);
    setFilters(initialFilters);
    setDateRangeState(initialDateRange);
  };

  const hasActiveFilters = useMemo(() => {
    const hasFilterValue = Object.values(filters).some((value) => Boolean(value));
    return Boolean(search.trim()) || hasFilterValue || hasActiveDateRange(dateRange);
  }, [dateRange, filters, search]);

  return {
    page,
    setPage,
    search,
    setSearch,
    debouncedSearch,
    filters,
    setFilter,
    updateFilters,
    dateRange,
    setDateRange,
    hasActiveFilters,
    resetAll,
  };
}
