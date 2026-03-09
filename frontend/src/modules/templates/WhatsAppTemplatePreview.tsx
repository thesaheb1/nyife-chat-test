import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BatteryFull,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  MoonStar,
  Phone,
  Reply,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Video,
  Wifi,
  Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Template } from '@/core/types';
import type { TemplateDraft, TemplateMediaAsset } from './templateBuilder';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  media_asset?: TemplateMediaAsset | null;
  buttons?: Array<Record<string, unknown>>;
  cards?: Array<{ components?: TemplateComponent[] }>;
  add_security_recommendation?: boolean;
  code_expiration_minutes?: number;
}

interface WhatsAppTemplatePreviewProps {
  templateName: string;
  type: Template['type'];
  components: unknown[];
  draft?: TemplateDraft;
}

function getComponent(components: TemplateComponent[], type: string) {
  return components.find((component) => String(component.type).toUpperCase() === type.toUpperCase()) || null;
}

function trim(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getDraftHeaderMedia(draft: TemplateDraft | undefined, type: Template['type'], cardIndex?: number) {
  if (!draft) {
    return null;
  }

  if (type === 'standard') {
    return draft.standard.headerMedia;
  }

  if (type === 'list_menu') {
    return draft.listMenu.headerMedia;
  }

  if (type === 'carousel' && typeof cardIndex === 'number') {
    return draft.carousel.cards[cardIndex]?.headerMedia || null;
  }

  return null;
}

function HeaderMediaPreview({
  format,
  media,
}: {
  format: string;
  media: TemplateMediaAsset | null;
}) {
  const normalized = String(format).toUpperCase();

  if (normalized === 'IMAGE' && media?.preview_url) {
    return (
      <div className="overflow-hidden rounded-[18px] border border-black/10 bg-[#d7d7d7]">
        <img src={media.preview_url} alt={media.original_name || 'Header media'} className="h-48 w-full object-cover" />
      </div>
    );
  }

  const Icon = normalized === 'VIDEO' ? Video : normalized === 'DOCUMENT' ? FileText : ImageIcon;

  return (
    <div className="rounded-[18px] border border-black/10 bg-[#d7d7d7] p-4 text-[#54656f]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {media?.original_name || `${normalized.toLowerCase()} sample`}
          </div>
          <div className="text-xs">{media?.mime_type || normalized}</div>
        </div>
      </div>
    </div>
  );
}

function renderButtonLabel(button: Record<string, unknown>) {
  return trim(button.text) || trim(button.flow_name) || 'Action';
}

function TemplateCard({
  type,
  components,
  draft,
  cardIndex,
  theme = 'light',
}: {
  type: Template['type'];
  components: TemplateComponent[];
  draft?: TemplateDraft;
  cardIndex?: number;
  theme?: 'light' | 'dark';
}) {
  const header = getComponent(components, 'HEADER');
  const body = getComponent(components, 'BODY') || getComponent(components, 'body');
  const footer = getComponent(components, 'FOOTER');
  const buttons = getComponent(components, 'BUTTONS')?.buttons || [];
  const headerMedia = getDraftHeaderMedia(draft, type, cardIndex) || header?.media_asset || null;
  const headerText = trim(header?.text);
  const footerText = trim(footer?.text);
  const isDark = theme === 'dark';

  return (
    <div className={cn(
      'overflow-hidden rounded-[18px] border',
      isDark ? 'border-white/10 bg-[#202c33]' : 'border-black/10 bg-white'
    )}>
      {header?.format && header.format !== 'TEXT' ? (
        <div className="p-3 pb-0">
          <HeaderMediaPreview format={header.format} media={headerMedia} />
        </div>
      ) : null}
      {headerText ? (
        <div className={cn(
          'px-4 pt-4 text-[15px] font-semibold leading-5',
          isDark ? 'text-[#e9edef]' : 'text-[#111b21]'
        )}>
          {headerText}
        </div>
      ) : null}

      <div className={cn(
        'space-y-2 px-4 py-4',
        isDark ? 'text-[#e9edef]' : 'text-[#111b21]'
      )}>
        {type === 'authentication' ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0a7c65]">
          <ShieldCheck className="h-4 w-4" />
          Verification code
            </div>
            <p className="text-sm leading-5">Use the button below to complete your sign in.</p>
          </>
        ) : (
          <p className="text-sm leading-5 whitespace-pre-wrap">
            {trim(body?.text) || 'Template body preview'}
          </p>
        )}

        {footerText ? (
          <p className={cn(
            'text-[11px] leading-4',
            isDark ? 'text-[#8696a0]' : 'text-[#667781]'
          )}>{footerText}</p>
        ) : null}

        {type === 'authentication' && typeof footer?.code_expiration_minutes === 'number' ? (
          <p className={cn(
            'text-[11px] leading-4',
            isDark ? 'text-[#8696a0]' : 'text-[#667781]'
          )}>
            Code expires in {footer.code_expiration_minutes} minutes
          </p>
        ) : null}
      </div>

      {buttons.length ? (
        <div className={cn('border-t', isDark ? 'border-white/10' : 'border-black/10')}>
          {buttons.map((button, index) => {
            const buttonType = String(button.type || '').toUpperCase();
            const Icon =
              buttonType === 'FLOW'
                ? Workflow
                : buttonType === 'CATALOG' || buttonType === 'MPM'
                  ? ShoppingBag
                  : buttonType === 'URL'
                    ? ArrowUpRight
                    : buttonType === 'PHONE_NUMBER'
                      ? Phone
                      : buttonType === 'QUICK_REPLY'
                        ? Reply
                  : buttonType === 'OTP'
                    ? ShieldCheck
                    : null;

            return (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-center gap-2 border-b px-4 py-3 text-center text-[14px] font-medium text-[#00a884] last:border-b-0',
                  isDark ? 'border-white/10' : 'border-black/10'
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span>{renderButtonLabel(button)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CarouselPreview({
  components,
  draft,
  theme,
}: {
  components: TemplateComponent[];
  draft?: TemplateDraft;
  theme: 'light' | 'dark';
}) {
  const carousel = getComponent(components, 'CAROUSEL');

  if (!carousel?.cards?.length) {
    return <TemplateCard type="carousel" components={components} draft={draft} theme={theme} />;
  }

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {carousel.cards.map((card, index) => (
        <div key={index} className="w-[256px] shrink-0">
          <TemplateCard
            type="carousel"
            components={Array.isArray(card.components) ? card.components : []}
            draft={draft}
            cardIndex={index}
            theme={theme}
          />
        </div>
      ))}
    </div>
  );
}

export function WhatsAppTemplatePreview({
  templateName,
  type,
  components,
  draft,
}: WhatsAppTemplatePreviewProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const normalizedComponents = useMemo(
    () => (Array.isArray(components) ? (components as TemplateComponent[]) : []),
    [components]
  );

  return (
    <div className="rounded-[32px] border border-border/70 bg-[#f3f4f6] p-5 shadow-sm dark:bg-[#0e1114]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">WhatsApp mobile preview</p>
          <p className="text-xs text-muted-foreground">
            Realistic chat preview for {templateName || 'your template'}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/70 bg-background/90 p-1">
          <Button
            type="button"
            variant={theme === 'light' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={() => setTheme('light')}
          >
            <Sun className="mr-1.5 h-4 w-4" />
            Light
          </Button>
          <Button
            type="button"
            variant={theme === 'dark' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={() => setTheme('dark')}
          >
            <MoonStar className="mr-1.5 h-4 w-4" />
            Dark
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[372px]">
        <div className="rounded-[44px] bg-black p-[10px] shadow-[0_18px_36px_rgba(15,23,42,0.18)]">
          <div className={cn(
            'relative overflow-hidden rounded-[34px]',
            theme === 'light' ? 'bg-[#efeae2]' : 'bg-[#0b141a]'
          )}>
            <div className="absolute left-1/2 top-2 z-20 h-7 w-36 -translate-x-1/2 rounded-full bg-black" />

            <div className="relative z-10 flex items-center justify-between px-6 pt-4 text-[11px] font-semibold text-white">
              <span>{theme === 'light' ? '10:08' : '11:13'}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex items-end gap-[2px]">
                  <span className="h-[4px] w-[2px] rounded-full bg-white/65" />
                  <span className="h-[6px] w-[2px] rounded-full bg-white/75" />
                  <span className="h-[8px] w-[2px] rounded-full bg-white/85" />
                  <span className="h-[10px] w-[2px] rounded-full bg-white" />
                </div>
                <Wifi className="h-3.5 w-3.5" />
                <div className="relative">
                  <BatteryFull className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className={cn(
              'mt-3 flex items-center gap-3 px-4 py-3 text-white',
              theme === 'light' ? 'bg-[#008069]' : 'bg-[#202c33]'
            )}>
              <ChevronLeft className="h-5 w-5" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#0f3f38] text-sm font-semibold">
                NY
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold">{templateName || 'Nyife Business'}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#25d366]" />
                </div>
                <div className="text-[11px] text-white/80">online</div>
              </div>
            </div>

            <div className={cn(
              'min-h-[560px] bg-cover bg-center px-3 pb-6 pt-4',
              theme === 'light'
                ? "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23d7ccc8%22 fill-opacity=%220.28%22%3E%3Cpath d=%22M20 20c0-5.523 4.477-10 10-10v10H20zM10 30C4.477 30 0 25.523 0 20h10v10zM40 20c0 5.523-4.477 10-10 10V20h10zM20 0c5.523 0 10 4.477 10 10H20V0z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
                : "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%230f2b32%22 fill-opacity=%220.45%22%3E%3Cpath d=%22M20 20c0-5.523 4.477-10 10-10v10H20zM10 30C4.477 30 0 25.523 0 20h10v10zM40 20c0 5.523-4.477 10-10 10V20h10zM20 0c5.523 0 10 4.477 10 10H20V0z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]"
            )}>
              <div className="mb-3 flex justify-center">
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-[#667781]">
                  Today
                </span>
              </div>

              <div className="mb-3 flex justify-center">
                <div className={cn(
                  'max-w-[255px] rounded-[12px] px-3 py-2 text-center text-[11px] leading-4',
                  theme === 'light' ? 'bg-[#d9fdd3] text-[#54656f]' : 'bg-[#1f2c34] text-[#d1d7db]'
                )}>
                  This business works with other companies to manage this chat. Tap to learn more.
                </div>
              </div>

              <div className="space-y-3">
                <div className={cn(
                  'w-[88%] rounded-[18px] rounded-bl-md',
                  theme === 'light' ? 'bg-white' : 'bg-[#202c33]'
                )}>
                  {type === 'carousel' ? (
                    <div className="p-3">
                      <CarouselPreview components={normalizedComponents} draft={draft} theme={theme} />
                    </div>
                  ) : (
                    <div className="p-3">
                      <TemplateCard type={type} components={normalizedComponents} draft={draft} theme={theme} />
                    </div>
                  )}
                  <div className={cn(
                    'px-4 pb-3 text-right text-[10px]',
                    theme === 'light' ? 'text-[#667781]' : 'text-[#8696a0]'
                  )}>10:08 AM</div>
                </div>

                <div className={cn(
                  'ml-auto w-[62%] rounded-[18px] rounded-br-md px-4 py-3 text-xs',
                  theme === 'light'
                    ? 'bg-[#d9fdd3] text-[#111b21]'
                    : 'bg-[#005c4b] text-white'
                )}>
                  Template preview ready
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em]">
            {type.replace('_', ' ')}
          </Badge>
        </div>
      </div>
    </div>
  );
}
