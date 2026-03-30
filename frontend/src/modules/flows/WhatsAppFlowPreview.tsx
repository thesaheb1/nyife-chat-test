import { useState } from 'react';
import {
  BadgeCheck,
  BatteryFull,
  Camera,
  ChevronLeft,
  Mic,
  MoonStar,
  MoreVertical,
  Paperclip,
  Search,
  SmilePlus,
  Sun,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FlowDefinition } from '@/core/types';
import { cn } from '@/lib/utils';
import {
  FlowJourneyPreview,
  type FlowPreviewTheme,
} from './FlowComponentPreview';

function getInitials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'NB';
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'NB';
}

export function WhatsAppFlowPreview({
  definition,
  builderSupported = true,
  warning,
  accountName,
  accountPhone,
  className,
}: {
  definition: FlowDefinition;
  builderSupported?: boolean;
  warning?: string | null;
  accountName?: string | null;
  accountPhone?: string | null;
  className?: string;
}) {
  const [theme, setTheme] = useState<FlowPreviewTheme>('light');
  const isDark = theme === 'dark';
  const title = String(accountName || '').trim() || 'Nyife Business';
  const subtitle = String(accountPhone || '').trim() || 'Business account';
  const showVerifiedBadge = Boolean(String(accountName || '').trim());

  return (
    <div
      className={cn(
        'rounded-[24px] border border-[#dde4eb] bg-[linear-gradient(180deg,rgba(250,252,254,0.98),rgba(243,246,250,0.96))] p-3 shadow-sm',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            WhatsApp Preview
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/70 bg-background/90 p-0.5 shadow-sm">
          <Button
            type="button"
            variant={theme === 'light' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setTheme('light')}
            aria-label="Show light preview"
          >
            <Sun className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant={theme === 'dark' ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setTheme('dark')}
            aria-label="Show dark preview"
          >
            <MoonStar className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-72">
        <div className="rounded-[34px] bg-[#111b21] p-1.75 shadow-[0_18px_44px_rgba(15,23,42,0.26)]">
          <div className={cn('overflow-hidden rounded-[27px]', isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]')}>
            <div className="relative">
              <div className="absolute left-1/2 top-2 z-20 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />

              <div className={cn('relative z-10 flex items-center justify-between px-4 pt-2.5 text-[10px] font-semibold', isDark ? 'text-white' : 'text-black')}>
                <span>10:08</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-0.5">
                    <span className={cn('h-1 w-0.5 rounded-full', isDark ? 'bg-white/65' : 'bg-black/65')} />
                    <span className={cn('h-1.5 w-0.5 rounded-full', isDark ? 'bg-white/75' : 'bg-black/75')} />
                    <span className={cn('h-2 w-0.5 rounded-full', isDark ? 'bg-white/85' : 'bg-black/85')} />
                    <span className={cn('h-2.5 w-0.5 rounded-full', isDark ? 'bg-white' : 'bg-black')} />
                  </div>
                  <Wifi className="h-3.5 w-3.5" />
                  <BatteryFull className="h-4 w-4" />
                </div>
              </div>

              <div className={cn('mt-2.5 flex items-center gap-2.5 px-3.5 py-2.5 text-white', isDark ? 'bg-[#202c33]' : 'bg-[#008069]')}>
                <ChevronLeft className="h-4.5 w-4.5" />
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                  {getInitials(title)}
                  {showVerifiedBadge ? (
                    <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-white text-[#25D366]" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{title}</div>
                  <div className="truncate text-[10px] text-white/80">{subtitle}</div>
                </div>
                <Search className="h-3.5 w-3.5" />
                <MoreVertical className="h-3.5 w-3.5" />
              </div>
            </div>

            <ScrollArea className="h-90 overflow-y-auto px-2.5 pb-3 pt-3">
              <div className="mb-3 flex justify-center">
                <span
                  className={cn(
                    'rounded-full px-2 py-1 text-[9px] font-medium',
                    isDark ? 'bg-[#1f2c34] text-[#d1d7db]' : 'bg-white/85 text-[#667781]'
                  )}
                >
                  Today
                </span>
              </div>

              <div className="mb-3 flex justify-center">
                <div
                  className={cn(
                    'max-w-56 rounded-[10px] px-3 py-2 text-center text-[10px] leading-4 shadow-sm',
                    isDark ? 'bg-[#182229] text-[#d1d7db]' : 'bg-[#fff3c4] text-[#54656f]'
                  )}
                >
                  Use this as a fast local authoring preview. Meta web preview remains the exact source of truth before publish.
                </div>
              </div>

              <div className="max-w-[92%]">
                <div
                  className={cn(
                    'rounded-[18px] px-3 py-3 shadow-sm',
                    isDark ? 'bg-[#202c33] text-[#e9edef]' : 'bg-white text-[#111b21]'
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold">Interactive flow</p>
                      <p className={cn('text-[10px]', isDark ? 'text-[#aebac1]' : 'text-[#667781]')}>
                        WhatsApp opens flows as guided interactive forms.
                      </p>
                    </div>
                    <span className={cn('rounded-full px-2 py-1 text-[10px] font-medium', isDark ? 'bg-[#111b21] text-[#d1d7db]' : 'bg-[#f0f2f5] text-[#54656f]')}>
                      Local preview
                    </span>
                  </div>

                  {builderSupported ? (
                    <FlowJourneyPreview
                      definition={definition}
                      appearance="whatsapp"
                      theme={theme}
                    />
                  ) : (
                    <div
                      className={cn(
                        'rounded-[18px] border px-4 py-4 text-[12px]',
                        isDark ? 'border-[#6b4d10] bg-[#2b2110] text-[#f5d58b]' : 'border-[#ead49a] bg-[#fff8df] text-[#8a5a00]'
                      )}
                    >
                      {warning || 'This flow uses unsupported builder features, so the WhatsApp preview stays in JSON-only safe mode.'}
                    </div>
                  )}

                  <div className={cn('mt-2 text-right text-[10px]', isDark ? 'text-[#aebac1]' : 'text-[#667781]')}>
                    10:08
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className={cn('border-t px-2.5 py-2', isDark ? 'border-white/8 bg-[#202c33]' : 'border-black/8 bg-[#f0f2f5]')}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex flex-1 items-center gap-2 rounded-full px-3 py-1.5',
                    isDark ? 'bg-[#2a3942] text-[#8696a0]' : 'bg-white text-[#667781]'
                  )}
                >
                  <SmilePlus className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-[12px]">Message</span>
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <Camera className="h-3.5 w-3.5 shrink-0" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884] text-white">
                  <Mic className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
