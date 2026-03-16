import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import {
  DATE_RANGE_PRESETS,
  formatDateInputValue,
  getDateRangeLabel,
  getPresetDateRange,
  parseDateValue,
  type DateRangePresetKey,
  type DateRangeValue,
} from '@/shared/utils/dateRange';
import { cn } from '@/lib/utils';

export interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  placeholder?: string;
  className?: string;
}

type PresentationMode = 'popover' | 'dialog' | 'sheet';

function toCalendarRange(value: DateRangeValue): DateRange | undefined {
  const from = parseDateValue(value.from);
  const to = parseDateValue(value.to);

  if (!from && !to) {
    return undefined;
  }

  return { from, to };
}

function toCommittedRange(range?: DateRange): DateRangeValue {
  if (!range?.from) {
    return {};
  }

  const from = formatDateInputValue(range.from);
  const to = formatDateInputValue(range.to || range.from);

  return { from, to };
}

function PanelContent({
  draftRange,
  onDraftChange,
  onPreset,
  onClear,
  onCancel,
  onApply,
  monthsToShow,
  footerClassName,
}: {
  draftRange?: DateRange;
  onDraftChange: (range?: DateRange) => void;
  onPreset: (preset: DateRangePresetKey) => void;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
  monthsToShow: number;
  footerClassName?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-5 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DATE_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={() => onPreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="rounded-xl border bg-background/70 p-2 shadow-sm sm:p-4">
            <div className="flex justify-center overflow-x-auto">
              <Calendar
                mode="range"
                min={1}
                defaultMonth={draftRange?.from || new Date()}
                selected={draftRange}
                onSelect={onDraftChange}
                numberOfMonths={monthsToShow}
                className="w-fit"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={cn('border-t bg-background px-4 py-3 sm:px-5', footerClassName)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs text-muted-foreground">
            {draftRange?.from
              ? getDateRangeLabel(toCommittedRange(draftRange))
              : 'Select a start and end date, or apply a single day range.'}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button type="button" variant="ghost" size="sm" className="w-full sm:w-auto" onClick={onClear}>
              <RotateCcw className="h-4 w-4" />
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" className="w-full sm:w-auto" onClick={onApply}>
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DateRangeFilter({
  value,
  onChange,
  placeholder = 'Select date range',
  className,
}: DateRangeFilterProps) {
  const isNarrowScreen = useMediaQuery('(max-width: 767px)');
  const isTabletWidth = useMediaQuery('(max-width: 1200px)');
  const isShortViewport = useMediaQuery('(max-height: 920px)');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState<PresentationMode>(() =>
    isNarrowScreen ? 'sheet' : isShortViewport || isTabletWidth ? 'dialog' : 'popover'
  );
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => toCalendarRange(value));

  const committedRange = useMemo(() => toCalendarRange(value), [value.from, value.to]);
  const monthsToShow =
    presentationMode === 'popover' && !isTabletWidth && !isShortViewport ? 2 : 1;

  useEffect(() => {
    if (!open) {
      setDraftRange(committedRange);
    }
  }, [committedRange, open]);

  useEffect(() => {
    if (!open) {
      setPresentationMode(
        isNarrowScreen ? 'sheet' : isShortViewport || isTabletWidth ? 'dialog' : 'popover'
      );
    }
  }, [isNarrowScreen, isShortViewport, isTabletWidth, open]);

  const resolvePresentation = (): PresentationMode => {
    if (typeof window === 'undefined') {
      if (isNarrowScreen) {
        return 'sheet';
      }

      return isShortViewport || isTabletWidth ? 'dialog' : 'popover';
    }

    if (isNarrowScreen) {
      return 'sheet';
    }

    if (isShortViewport || isTabletWidth) {
      return 'dialog';
    }

    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (!triggerRect) {
      return 'popover';
    }

    const viewportHeight = window.innerHeight;
    const availableAbove = Math.max(triggerRect.top - 16, 0);
    const availableBelow = Math.max(viewportHeight - triggerRect.bottom - 16, 0);
    const minimumPopoverHeight = 720;

    return Math.max(availableAbove, availableBelow) < minimumPopoverHeight ? 'dialog' : 'popover';
  };

  const handleOpen = () => {
    setPresentationMode(resolvePresentation());
    setOpen(true);
  };

  const triggerButton = (
    <Button
      ref={triggerRef}
      type="button"
      variant="outline"
      className={cn('justify-start text-left', className)}
      onClick={handleOpen}
    >
      <CalendarIcon className="h-4 w-4" />
      <span className="truncate">{getDateRangeLabel(value, placeholder)}</span>
    </Button>
  );

  const handlePreset = (presetKey: DateRangePresetKey) => {
    const presetRange = getPresetDateRange(presetKey);
    onChange(presetRange);
    setDraftRange(toCalendarRange(presetRange));
    setOpen(false);
  };

  const handleClear = () => {
    onChange({});
    setDraftRange(undefined);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraftRange(committedRange);
    setOpen(false);
  };

  const handleApply = () => {
    onChange(toCommittedRange(draftRange));
    setOpen(false);
  };

  const panel = (
    <PanelContent
      draftRange={draftRange}
      onDraftChange={setDraftRange}
      onPreset={handlePreset}
      onClear={handleClear}
      onCancel={handleCancel}
      onApply={handleApply}
      monthsToShow={monthsToShow}
    />
  );

  if (presentationMode === 'sheet') {
    return (
      <>
        {triggerButton}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b pb-4">
              <SheetTitle>Date range</SheetTitle>
              <SheetDescription>
                Use a quick preset or choose a custom range from the calendar.
              </SheetDescription>
            </SheetHeader>
            {panel}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (presentationMode === 'dialog') {
    return (
      <>
        {triggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[92dvh] w-[min(100vw-1rem,52rem)] flex-col overflow-hidden p-0">
            <DialogHeader className="border-b px-4 py-4 sm:px-5">
              <DialogTitle>Date range</DialogTitle>
              <DialogDescription>
                Use a quick preset or choose a custom range from the calendar.
              </DialogDescription>
            </DialogHeader>
            <PanelContent
              draftRange={draftRange}
              onDraftChange={setDraftRange}
              onPreset={handlePreset}
              onClear={handleClear}
              onCancel={handleCancel}
              onApply={handleApply}
              monthsToShow={monthsToShow}
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverAnchor asChild>{triggerButton}</PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[min(100vw-1rem,44rem)] overflow-hidden p-0"
        collisionPadding={16}
        style={{
          maxHeight: 'min(85dvh, var(--radix-popover-content-available-height, 85dvh))',
        }}
      >
        <PopoverHeader className="border-b px-4 py-4">
          <PopoverTitle>Date range</PopoverTitle>
          <PopoverDescription>
            Use a quick preset or choose a custom range from the calendar.
          </PopoverDescription>
        </PopoverHeader>
        {panel}
      </PopoverContent>
    </Popover>
  );
}
