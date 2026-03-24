import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

export interface TemplateSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface TemplateOptionSelectProps {
  value?: string | null;
  options: TemplateSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TemplateOptionSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onChange,
  disabled,
}: TemplateOptionSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const optionsHeightClass = isMobile ? 'h-[min(26rem,60vh)]' : 'h-[min(28rem,65vh)]';

  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((option) => {
      const haystack = `${option.label} ${option.value} ${option.description || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [options, search]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
    }
  };

  const renderTrigger = (onActivate?: () => void) => (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="h-auto min-h-11 w-full justify-between gap-3 px-3 py-2.5"
      disabled={disabled}
      onClick={onActivate}
    >
      <span className="min-w-0 flex-1 text-left">
        {selected ? (
          <span className="block">
            <span className="block break-words font-medium leading-5">{selected.label}</span>
            {selected.value !== selected.label ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">{selected.value}</span>
            ) : null}
          </span>
        ) : (
          <span className="block text-muted-foreground">{placeholder}</span>
        )}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
    </Button>
  );

  const optionList = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filteredOptions.length} option{filteredOptions.length === 1 ? '' : 's'}
        </p>
      </div>
      <ScrollArea className={cn('min-h-0 flex-1', optionsHeightClass)}>
        <div className="p-1.5">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : filteredOptions.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setSearch('');
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                  isSelected && 'bg-accent/60'
                )}
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <span className="break-words font-medium leading-5">{option.label}</span>
                    {option.value !== option.label ? (
                      <span className="text-xs text-muted-foreground sm:shrink-0">{option.value}</span>
                    ) : null}
                  </div>
                  {option.description ? (
                    <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        {renderTrigger(() => {
          if (!disabled) {
            handleOpenChange(true);
          }
        })}
        <SheetContent
          side="bottom"
          className="flex h-[min(85vh,42rem)] flex-col gap-0 rounded-t-[28px] p-0 sm:max-w-none"
        >
          <SheetHeader className="border-b px-4 pb-3 pt-5">
            <SheetTitle>Select an option</SheetTitle>
            <SheetDescription>
              Search and choose from the available Meta-supported values without losing options off-screen.
            </SheetDescription>
          </SheetHeader>
          {optionList}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {renderTrigger()}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(48rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] p-0"
      >
        {optionList}
      </PopoverContent>
    </Popover>
  );
}
