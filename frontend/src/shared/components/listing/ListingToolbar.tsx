import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangeFilter } from '@/shared/components/DateRangeFilter';
import type { DateRangeValue } from '@/shared/utils/dateRange';

export interface ListingToolbarFilterOption {
  label: string;
  value: string;
}

export interface ListingToolbarFilter {
  id: string;
  value: string;
  placeholder: string;
  options: ReadonlyArray<ListingToolbarFilterOption>;
  allLabel?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ListingToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  dateRange,
  onDateRangeChange,
  dateRangePlaceholder,
  onReset,
  resetLabel = 'Reset Filters',
  hasActiveFilters = false,
  actions,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ListingToolbarFilter[];
  dateRange?: DateRangeValue;
  onDateRangeChange?: (range: DateRangeValue) => void;
  dateRangePlaceholder?: string;
  onReset?: () => void;
  resetLabel?: string;
  hasActiveFilters?: boolean;
  actions?: ReactNode;
}) {
  const hasSearch = typeof searchValue === 'string' && typeof onSearchChange === 'function';

  return (
    <div className="flex flex-1 items-center flex-wrap gap-3">
      {hasSearch ? (
        <Input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-xs"
        />
      ) : null}

      {filters.map((filter) => (
        <Select
          key={filter.id}
          value={filter.value || 'all'}
          onValueChange={(value) => filter.onChange(value === 'all' ? '' : value)}
        >
          <SelectTrigger className={filter.className}>
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{filter.allLabel || `All ${filter.placeholder.toLowerCase()}`}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={`${filter.id}-${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {onDateRangeChange ? (
        <DateRangeFilter
          value={dateRange || {}}
          onChange={onDateRangeChange}
          placeholder={dateRangePlaceholder}
        />
      ) : null}
      {actions}
      {onReset && hasActiveFilters ? (
        <Button variant="ghost" onClick={onReset}>
          {resetLabel}
        </Button>
      ) : null}
    </div>
  );
}
