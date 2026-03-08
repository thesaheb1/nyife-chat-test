import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate text-left">
            {selected ? `${selected.label} (${selected.value})` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0" align="start">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-1">
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
                    'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/60'
                  )}
                >
                  <div className="flex h-5 w-5 items-center justify-center">
                    <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{option.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{option.value}</span>
                    </div>
                    {option.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
