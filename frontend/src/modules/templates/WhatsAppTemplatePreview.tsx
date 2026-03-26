import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  BatteryFull,
  Camera,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  MoonStar,
  Paperclip,
  Phone,
  Reply,
  Search,
  ShieldCheck,
  ShoppingBag,
  SmilePlus,
  Sun,
  Video,
  Wifi,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Template } from '@/core/types';
import type { TemplateDraft, TemplateMediaAsset } from './templateBuilder';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthenticatedImageSrc } from '@/shared/hooks/useAuthenticatedImageSrc';

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  otp_type?: string;
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
  accountName?: string | null;
  accountPhone?: string | null;
  className?: string;
}

function getComponent(components: TemplateComponent[], type: string) {
  return components.find((component) => String(component.type).toUpperCase() === type.toUpperCase()) || null;
}

function trim(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInitials(name: string) {
  const parts = trim(name).split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'NB';
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'NB';
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

function renderButtonLabel(button: Record<string, unknown>) {
  return trim(button.text) || trim(button.flow_name) || 'Action';
}

function getButtonIcon(buttonType: string) {
  switch (buttonType) {
    case 'FLOW':
      return Workflow;
    case 'CATALOG':
    case 'MPM':
      return ShoppingBag;
    case 'URL':
      return ArrowUpRight;
    case 'PHONE_NUMBER':
      return Phone;
    case 'QUICK_REPLY':
      return Reply;
    case 'OTP':
      return ShieldCheck;
    default:
      return null;
  }
}

function HeaderMediaPreview({
  format,
  media,
  theme,
}: {
  format: string;
  media: TemplateMediaAsset | null;
  theme: 'light' | 'dark';
}) {
  const normalized = String(format).toUpperCase();
  const resolvedImageSrc = useAuthenticatedImageSrc(
    normalized === 'IMAGE' ? media?.preview_url : undefined,
    media?.file_id || media?.header_handle || null
  );

  if (normalized === 'IMAGE' && resolvedImageSrc) {
    return (
      <div className="overflow-hidden rounded-[14px] bg-[#d8d8d8]">
        <img src={resolvedImageSrc} alt={media?.original_name || 'Header media'} className="h-32 w-full object-cover" />
      </div>
    );
  }

  const Icon = normalized === 'VIDEO' ? Video : normalized === 'DOCUMENT' ? FileText : ImageIcon;

  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-2.5',
        theme === 'dark'
          ? 'border-white/8 bg-[#111b21] text-[#aebac1]'
          : 'border-black/8 bg-[#f0f2f5] text-[#667781]'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[14px]',
            theme === 'dark' ? 'bg-[#202c33]' : 'bg-white'
          )}
        >
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

function TemplateMessageCard({
  type,
  components,
  draft,
  theme,
  cardIndex,
  showTimestamp = true,
}: {
  type: Template['type'];
  components: TemplateComponent[];
  draft?: TemplateDraft;
  theme: 'light' | 'dark';
  cardIndex?: number;
  showTimestamp?: boolean;
}) {
  const header = getComponent(components, 'HEADER');
  const body = getComponent(components, 'BODY');
  const footer = getComponent(components, 'FOOTER');
  const buttons = getComponent(components, 'BUTTONS')?.buttons || [];
  const headerMedia = getDraftHeaderMedia(draft, type, cardIndex) || header?.media_asset || null;
  const headerText = trim(header?.text);
  const bodyText = trim(body?.text) || 'Preview text appears here';
  const footerText = trim(footer?.text);
  const isDark = theme === 'dark';
  const otpButton = buttons.find((button) => String(button.type || '').toUpperCase() === 'OTP') || null;
  const showSecurityRecommendation = body?.add_security_recommendation ?? draft?.authentication.addSecurityRecommendation ?? false;
  const codeExpirationMinutes =
    typeof footer?.code_expiration_minutes === 'number'
      ? footer.code_expiration_minutes
      : typeof draft?.authentication.codeExpirationMinutes === 'number'
        ? draft.authentication.codeExpirationMinutes
        : null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[14px] rounded-bl-[6px]',
        isDark ? 'bg-[#202c33]' : 'bg-white shadow-[0_1px_0_rgba(11,20,26,0.08)]'
      )}
    >
      {header?.format && header.format !== 'TEXT' ? (
        <div className="px-2 pt-2">
          <HeaderMediaPreview format={header.format} media={headerMedia} theme={theme} />
        </div>
      ) : null}

      <div className="px-3 pt-2.5">
        {headerText ? (
          <div className={cn('mb-1.5 text-[13px] font-semibold', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
            {headerText}
          </div>
        ) : null}

        {type === 'authentication' ? (
          <div className={cn('space-y-2.5 text-[13px] leading-5', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
            <p>Use this verification code to continue securely.</p>
            <div
              className={cn(
                'rounded-2xl border px-3.5 py-2.5 text-center text-[20px] font-semibold tracking-[0.34em]',
                isDark ? 'border-white/8 bg-[#111b21]' : 'border-black/8 bg-[#f5f6f6]'
              )}
            >
              123456
            </div>
            {showSecurityRecommendation ? (
              <p className={cn('text-[12px] leading-4', isDark ? 'text-[#aebac1]' : 'text-[#667781]')}>
                For your security, do not share this code with anyone.
              </p>
            ) : null}
            {codeExpirationMinutes ? (
              <p className={cn('text-[12px] leading-4', isDark ? 'text-[#aebac1]' : 'text-[#667781]')}>
                This code expires in {codeExpirationMinutes} minutes.
              </p>
            ) : null}
          </div>
        ) : (
          <div className={cn('whitespace-pre-wrap text-[13px] leading-[1.45]', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
            {bodyText}
          </div>
        )}

        {footerText ? (
          <div className={cn('mt-2.5 text-[10.5px] leading-4', isDark ? 'text-[#8696a0]' : 'text-[#667781]')}>
            {footerText}
          </div>
        ) : null}
      </div>

      {buttons.length ? (
        <div className={cn('mt-2.5 border-t', isDark ? 'border-white/8' : 'border-black/8')}>
          {buttons.map((button, index) => {
            const buttonType = String(button.type || '').toUpperCase();
            const Icon = getButtonIcon(buttonType);
            const buttonLabel = buttonType === 'OTP' && otpButton
              ? renderButtonLabel(otpButton)
              : renderButtonLabel(button);

            return (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-center gap-2 border-b px-3 py-2.5 text-center text-[12px] font-medium last:border-b-0',
                  isDark
                    ? 'border-white/8 text-[#53bdeb]'
                    : 'border-black/8 text-[#027eb5]'
                )}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                <span className="truncate">{buttonLabel}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {showTimestamp ? (
        <div className="flex justify-end px-3 pb-2 pt-1.5">
          <span className={cn('text-[10px]', isDark ? 'text-[#8696a0]' : 'text-[#667781]')}>
            10:08 AM
          </span>
        </div>
      ) : null}
    </div>
  );
}

function CarouselMessage({
  components,
  draft,
  theme,
}: {
  components: TemplateComponent[];
  draft?: TemplateDraft;
  theme: 'light' | 'dark';
}) {
  const carousel = getComponent(components, 'CAROUSEL');
  const body = getComponent(components, 'BODY');
  const cards = Array.isArray(carousel?.cards) ? carousel.cards : [];
  const introBodyText = trim(body?.text);
  const isDark = theme === 'dark';

  if (!cards.length) {
    return <TemplateMessageCard type="carousel" components={components} draft={draft} theme={theme} />;
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl rounded-bl-[6px]',
        isDark ? 'bg-[#202c33]' : 'bg-white shadow-[0_1px_0_rgba(11,20,26,0.08)]'
      )}
    >
      {introBodyText ? (
        <div className="px-3.5 pb-1 pt-3">
          <div className={cn('text-[13px] leading-[1.45]', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
            {introBodyText}
          </div>
        </div>
      ) : null}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-3 py-3">
        {cards.map((card, index) => (
          <div key={index} className="w-49 shrink-0">
            <TemplateMessageCard
              type="carousel"
              components={Array.isArray(card.components) ? card.components : []}
              draft={draft}
              cardIndex={index}
              theme={theme}
              showTimestamp={false}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end px-3.5 pb-2.5">
        <span className={cn('text-[10px]', isDark ? 'text-[#8696a0]' : 'text-[#667781]')}>
          10:08 AM
        </span>
      </div>
    </div>
  );
}

export function WhatsAppTemplatePreview({
  templateName,
  type,
  components,
  draft,
  accountName,
  accountPhone,
  className,
}: WhatsAppTemplatePreviewProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const normalizedComponents = useMemo(
    () => (Array.isArray(components) ? (components as TemplateComponent[]) : []),
    [components]
  );
  const isDark = theme === 'dark';
  const title = trim(accountName) || trim(templateName) || 'Nyife Business';
  const subtitle = trim(accountPhone) || 'Business account';
  const showVerifiedBadge = Boolean(trim(accountName));

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

      <div className="mx-auto w-full max-w-70">
        <div className="rounded-[34px] bg-[#111b21] p-1.75 shadow-[0_18px_44px_rgba(15,23,42,0.26)]">
          <div className={cn('overflow-hidden rounded-[27px]', isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]')}>
            <div className="relative">
              <div className="absolute left-1/2 top-2 z-20 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />

              <div className={cn('relative z-10 flex items-center justify-between px-4 pt-2.5 text-[10px] font-semibold', isDark ? 'text-white' : 'text-black')}>
                <span>10:08</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-end gap-0.5">
                    <span className={`h-1 w-0.5 rounded-full ${isDark ? 'bg-white/65' : 'bg-black/65'}`} />
                    <span className={`h-1.5 w-0.5 rounded-full ${isDark ? 'bg-white/75' : 'bg-black/75'}`} />
                    <span className={`h-2 w-0.5 rounded-full ${isDark ? 'bg-white/85' : 'bg-black/85'}`} />
                    <span className={`h-2.5 w-0.5 rounded-full ${isDark ? 'bg-white' : 'bg-black'}`} />
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

            <ScrollArea className={cn(
              'h-90 px-2.5 pb-3 pt-3 overflow-y-auto'
            )}>
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
                  This business works with other companies to manage this chat. Tap to learn more.
                </div>
              </div>

              <div className="max-w-[84%]">
                {type === 'carousel' ? (
                  <CarouselMessage components={normalizedComponents} draft={draft} theme={theme} />
                ) : (
                  <TemplateMessageCard type={type} components={normalizedComponents} draft={draft} theme={theme} />
                )}
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
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-white', isDark ? 'bg-[#00a884]' : 'bg-[#00a884]')}>
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
