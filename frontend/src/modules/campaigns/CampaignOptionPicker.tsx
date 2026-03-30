import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

export interface CampaignPickerOption {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  badge?: string;
}

interface CampaignOptionPickerProps {
  mode: 'single' | 'multiple';
  title: string;
  description: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: CampaignPickerOption[];
  selectedOptions: CampaignPickerOption[];
  search: string;
  page: number;
  totalPages: number;
  totalCount?: number;
  disabled?: boolean;
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (option: CampaignPickerOption) => void;
  onRemove: (option: CampaignPickerOption) => void;
  onClear?: () => void;
}

export function CampaignOptionPicker({
  mode,
  title,
  description,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  options,
  selectedOptions,
  search,
  page,
  totalPages,
  totalCount,
  disabled,
  isLoading,
  onSearchChange,
  onPageChange,
  onSelect,
  onRemove,
  onClear,
}: CampaignOptionPickerProps) {
  const [open, setOpen] = useState(false);
  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const selectedValues = useMemo(() => new Set(selectedOptions.map((option) => option.value)), [selectedOptions]);
  const isMultiple = mode === 'multiple';

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      onSearchChange('');
      onPageChange(1);
    }
  };

  const selectedText = isMultiple
    ? selectedOptions.length
      ? `${selectedOptions.length} selected`
      : placeholder
    : selectedOptions[0]?.label || placeholder;

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="h-auto min-h-11 w-full justify-between gap-3 px-3 py-2.5"
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          handleOpenChange(true);
        }
      }}
    >
      <span className="min-w-0 flex-1 text-left">
        <span className={cn('block break-words leading-5', selectedOptions.length ? 'font-medium' : 'text-muted-foreground')}>
          {selectedText}
        </span>
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
    </Button>
  );

  const optionList = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value);
              onPageChange(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isLoading ? 'Loading options...' : `${totalCount ?? options.length} option${(totalCount ?? options.length) === 1 ? '' : 's'}`}
        </p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {!isLoading && options.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            options.map((option) => {
              const isSelected = selectedValues.has(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onSelect(option);
                    if (!isMultiple) {
                      handleOpenChange(false);
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/60'
                  )}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
                    {isMultiple ? (
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                    ) : (
                      <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="break-words font-medium leading-5">{option.label}</span>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {option.badge ? <Badge variant="outline" className="text-[10px]">{option.badge}</Badge> : null}
                        {option.meta ? <span className="text-xs text-muted-foreground">{option.meta}</span> : null}
                      </div>
                    </div>
                    {option.description ? (
                      <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Page {Math.max(page, 1)} of {Math.max(totalPages, 1)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading || totalPages === 0}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            {isMultiple ? (
              <Button type="button" size="sm" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {isCompactViewport ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          {trigger}
          <SheetContent
            side="bottom"
            className="flex h-[92vh] flex-col gap-0 rounded-t-[28px] p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b px-4 pb-3 pt-5">
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>{description}</SheetDescription>
            </SheetHeader>
            {optionList}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          {trigger}
          <DialogContent className="flex h-[min(82vh,46rem)] max-w-[min(48rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-6 pb-4 pt-5 text-left">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {optionList}
          </DialogContent>
        </Dialog>
      )}

      {isMultiple && selectedOptions.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selectedOptions.length} selected
            </p>
            {onClear ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
                Clear all
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedOptions.map((option) => (
              <Badge key={option.value} variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
                <span className="max-w-[14rem] truncate">{option.label}</span>
                <button
                  type="button"
                  onClick={() => onRemove(option)}
                  className="rounded-full p-0.5 hover:bg-foreground/10"
                  aria-label={`Remove ${option.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
