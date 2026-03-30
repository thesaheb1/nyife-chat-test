import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  BatteryFull,
  Camera,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  MoreVertical,
  MoonStar,
  Paperclip,
  Phone,
  Play,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Template } from '@/core/types';
import { cn } from '@/lib/utils';
import { useAuthenticatedAssetSrc } from '@/shared/hooks/useAuthenticatedImageSrc';
import { useVideoPoster } from '@/shared/hooks/useVideoPoster';
import {
  resolveTemplateMediaSourceUrl,
  type TemplateDraft,
  type TemplateMediaAsset,
} from './templateBuilder';

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

type PreviewTheme = 'light' | 'dark';
type MediaPreviewVariant = 'message' | 'carousel';

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

function resolveHeaderMediaPreviewUrl(media: TemplateMediaAsset | null | undefined) {
  return resolveTemplateMediaSourceUrl(media);
}

function looksLikePdfPreviewUrl(url: string) {
  try {
    return new URL(url, window.location.origin).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return /\.pdf(?:$|[?#])/i.test(url);
  }
}

function looksLikeImagePreviewUrl(url: string) {
  try {
    const pathname = new URL(url, window.location.origin).pathname.toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some((extension) => pathname.endsWith(extension));
  } catch {
    return /\.(jpe?g|png|webp|gif)(?:$|[?#])/i.test(url);
  }
}

function isRemotePreviewUrl(url: string | null | undefined) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
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
  const buttonType = trim(button.type).toUpperCase();
  if (buttonType === 'OTP') {
    const otpType = trim(button.otp_type).toUpperCase();
    if (otpType === 'ZERO_TAP') {
      return 'Zero-tap';
    }
    if (otpType === 'ONE_TAP') {
      return 'Autofill';
    }
    return 'Copy code';
  }

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
  variant = 'message',
}: {
  format: string;
  media: TemplateMediaAsset | null;
  theme: PreviewTheme;
  variant?: MediaPreviewVariant;
}) {
  const normalized = String(format).toUpperCase();
  const previewUrl = resolveHeaderMediaPreviewUrl(media);
  const resolvedPreviewSrc = useAuthenticatedAssetSrc(
    previewUrl,
    media?.file_id || null,
    {
      fallbackSrc: isRemotePreviewUrl(media?.header_handle) ? media?.header_handle : null,
    }
  );
  const isDark = theme === 'dark';
  const isCarousel = variant === 'carousel';
  const imageHeightClass = isCarousel ? 'h-[144px]' : 'h-[136px]';
  const videoHeightClass = isCarousel ? 'h-[144px]' : 'h-[160px]';
  const frameRadiusClass = isCarousel ? 'rounded-t-[16px]' : 'rounded-[14px]';
  const hasResolvedPreview = typeof resolvedPreviewSrc === 'string' && resolvedPreviewSrc.length > 0;
  const showsVideoThumbnail = normalized === 'VIDEO'
    && hasResolvedPreview
    && !media?.mime_type?.startsWith('video/')
    && looksLikeImagePreviewUrl(resolvedPreviewSrc);
  const extractedVideoPoster = useVideoPoster(
    normalized === 'VIDEO' && hasResolvedPreview && !showsVideoThumbnail ? resolvedPreviewSrc : undefined
  );
  const videoPosterSrc = showsVideoThumbnail ? resolvedPreviewSrc : extractedVideoPoster;
  const isImage = hasResolvedPreview && (normalized === 'IMAGE' || Boolean(videoPosterSrc));
  const isVideo = normalized === 'VIDEO' && hasResolvedPreview && !videoPosterSrc;
  const isPdfDocument = normalized === 'DOCUMENT'
    && hasResolvedPreview
    && (media?.mime_type === 'application/pdf' || looksLikePdfPreviewUrl(resolvedPreviewSrc));

  if (normalized === 'LOCATION') {
    return (
      <div
        className={cn(
          'overflow-hidden border',
          frameRadiusClass,
          isDark ? 'border-white/8 bg-[#111b21]' : 'border-black/8 bg-[#f5f6f6]'
        )}
      >
        <div className={cn('flex items-center gap-3 px-3 py-3', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', isDark ? 'bg-[#202c33]' : 'bg-white')}>
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium">Location header</div>
            <div className={cn('text-xs', isDark ? 'text-[#aebac1]' : 'text-[#667781]')}>
              WhatsApp renders this as a map card.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className={cn('relative overflow-hidden bg-[#d8d8d8]', frameRadiusClass)}>
        <img
          src={normalized === 'VIDEO' ? videoPosterSrc || resolvedPreviewSrc : resolvedPreviewSrc}
          alt={media?.original_name || 'Header media'}
          className={cn(imageHeightClass, 'w-full object-cover')}
        />
        {normalized === 'VIDEO' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/30 via-black/5 to-black/30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-sm">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={cn('relative overflow-hidden bg-black', frameRadiusClass)}>
        <video
          src={resolvedPreviewSrc}
          muted
          playsInline
          preload="metadata"
          controls={false}
          className={cn(videoHeightClass, 'w-full bg-black object-contain')}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-black/35 via-black/0 to-black/20">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-sm">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </div>
        </div>
      </div>
    );
  }

  if (isPdfDocument && !isCarousel) {
    return (
      <div className={cn('overflow-hidden bg-white', frameRadiusClass)}>
        <iframe
          title={media?.original_name || 'Header document'}
          src={resolvedPreviewSrc}
          className="h-48 w-full bg-white"
        />
      </div>
    );
  }

  const Icon = normalized === 'VIDEO' ? Video : normalized === 'DOCUMENT' ? FileText : ImageIcon;

  return (
    <div
      className={cn(
        'border px-3 py-3',
        frameRadiusClass,
        isDark ? 'border-white/8 bg-[#111b21] text-[#aebac1]' : 'border-black/8 bg-[#f0f2f5] text-[#667781]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]',
            isDark ? 'bg-[#202c33]' : 'bg-white'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {media?.original_name || `${normalized.toLowerCase()} sample`}
          </div>
          <div className="mt-1 text-xs">{media?.mime_type || normalized}</div>
          {media?.size ? <div className="mt-1 text-[11px]">{Math.max(1, Math.round(media.size / 1024))} KB</div> : null}
          {normalized === 'DOCUMENT' ? (
            <div className="mt-1 text-[11px]">
              PDF files can render inline. Other documents appear as downloadable files in WhatsApp.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MessageActionButtons({
  buttons,
  theme,
  compact = false,
}: {
  buttons: Array<Record<string, unknown>>;
  theme: PreviewTheme;
  compact?: boolean;
}) {
  if (!buttons.length) {
    return null;
  }

  const isDark = theme === 'dark';
  const otpButton = buttons.find((button) => String(button.type || '').toUpperCase() === 'OTP') || null;

  return (
    <div className={cn('border-t', isDark ? 'border-white/8' : 'border-black/8')}>
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
              'flex items-center justify-center gap-2 border-b px-3 text-center font-medium last:border-b-0',
              compact ? 'py-2 text-[12px]' : 'py-2.5 text-[12px]',
              isDark ? 'border-white/8 text-[#53bdeb]' : 'border-black/8 text-[#027eb5]'
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span className="truncate">{buttonLabel}</span>
          </div>
        );
      })}
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
  theme: PreviewTheme;
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

      <MessageActionButtons buttons={buttons} theme={theme} />

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

function CarouselCardPreview({
  components,
  draft,
  theme,
  cardIndex,
}: {
  components: TemplateComponent[];
  draft?: TemplateDraft;
  theme: PreviewTheme;
  cardIndex: number;
}) {
  const header = getComponent(components, 'HEADER');
  const body = getComponent(components, 'BODY');
  const buttons = getComponent(components, 'BUTTONS')?.buttons || [];
  const headerMedia = getDraftHeaderMedia(draft, 'carousel', cardIndex) || header?.media_asset || null;
  const bodyText = trim(body?.text) || 'Preview text appears here';
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[18px] border',
        isDark ? 'border-white/8 bg-[#202c33]' : 'border-black/8 bg-white'
      )}
    >
      {header?.format ? (
        <HeaderMediaPreview
          format={header.format}
          media={headerMedia}
          theme={theme}
          variant="carousel"
        />
      ) : null}

      {trim(bodyText) ? (
        <div className="px-3 pb-3 pt-2.5">
          <div className={cn('line-clamp-4 text-[12.5px] leading-[1.35]', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
            {bodyText}
          </div>
        </div>
      ) : null}

      <MessageActionButtons buttons={buttons} theme={theme} compact />
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
  theme: PreviewTheme;
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
        'w-62.5 overflow-x-auto rounded-3xl rounded-bl-[6px] px-3',
        isDark ? 'bg-[#202c33]' : 'bg-white shadow-[0_1px_0_rgba(11,20,26,0.08)]'
      )}
    >
      <div className="pb-2 pt-3">

        {introBodyText ? (
          <div className={cn('text-[13px] leading-[1.45]', isDark ? 'text-[#e9edef]' : 'text-[#111b21]')}>
            {introBodyText}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2.5 pb-2">
          {cards.map((card, index) => (
            <div key={index} className="w-40 shrink-0">
              <CarouselCardPreview
                components={Array.isArray(card.components) ? card.components : []}
                draft={draft}
                cardIndex={index}
                theme={theme}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="px-3.5 pb-2 pt-0.5">
        <div className="flex justify-end">
          <span className={cn('text-[10px]', isDark ? 'text-[#8696a0]' : 'text-[#667781]')}>
            11:59
          </span>
        </div>
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
  const [theme, setTheme] = useState<PreviewTheme>('light');
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
                  This business works with other companies to manage this chat. Tap to learn more.
                </div>
              </div>

              <div className={cn(type === 'carousel' ? 'max-w-[94%]' : 'max-w-[84%]')}>
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
