import { useId, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader2,
  Play,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';
import type {
  HeaderFormat,
  StandardButtonDraft,
  TemplateMediaAsset,
} from './templateBuilder';
import { addStandardButton, buildTemplateMediaPreviewUrl, resolveTemplateMediaSourceUrl } from './templateBuilder';
import { describeTemplateVariables, syncTemplateExampleValues } from './templateExamples';
import {
  extractTemplateMediaMetadata,
  formatBytes,
  getTemplateMediaAccept,
  getTemplateMediaHelper,
  getTemplateMediaRule,
  validateTemplateMediaFile,
} from './templateMediaRules';
import { runTemplateActionToast } from './templateToast';
import { useUploadTemplateMedia } from './useTemplates';
import { useAuthenticatedAssetSrc } from '@/shared/hooks/useAuthenticatedImageSrc';
import { useVideoPoster } from '@/shared/hooks/useVideoPoster';

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}

export function ValidationSummary({
  valid,
  issueCount,
  compact = false,
}: {
  valid: boolean;
  issueCount: number;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border ${compact ? 'px-3 py-2.5' : 'p-4'}`}>
      {valid ? (
        <CheckCircle2 className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-emerald-600`} />
      ) : (
        <AlertTriangle className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-amber-600`} />
      )}
      <div className="min-w-0">
        <div className={compact ? 'text-sm font-medium' : 'font-medium'}>
          {valid ? 'Ready for save or update' : 'Validation required'}
        </div>
        <div className={`${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          {valid ? 'The current payload matches the type-specific frontend rules.' : `${issueCount} issue(s) still need attention.`}
        </div>
      </div>
    </div>
  );
}

export function TypeCard({
  title,
  description,
  active,
  disabled = false,
  compact = false,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border text-left transition ${compact ? 'p-3' : 'p-4'} ${active
        ? 'border-primary bg-primary/5 shadow-sm'
        : 'border-border hover:border-primary/40 hover:bg-muted/40'
        } ${disabled ? 'cursor-not-allowed opacity-60 hover:border-border hover:bg-transparent' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={compact ? 'text-sm font-semibold' : 'font-semibold'}>{title}</div>
        {active ? (
          <Badge className={compact ? 'h-5 px-2 text-[10px]' : undefined}>Selected</Badge>
        ) : (
          <ChevronRight className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-muted-foreground`} />
        )}
      </div>
      <p className={`${compact ? 'mt-1.5 text-xs leading-4' : 'mt-2 text-sm'} text-muted-foreground`}>{description}</p>
    </button>
  );
}

function getNextVariableToken(value: string) {
  const variables = describeTemplateVariables(value);
  const highest = variables.uniqueNumbers[variables.uniqueNumbers.length - 1] || 0;
  return `{{${highest + 1}}}`;
}

function TemplateVariableExamplesField({
  label,
  text,
  values,
  onChange,
}: {
  label: string;
  text: string;
  values: string[];
  onChange: (value: string[]) => void;
}) {
  const variables = describeTemplateVariables(text);

  if (!variables.count) {
    return null;
  }

  if (!variables.isSequential) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        Use sequential variable tokens starting at {`{{1}}`} before adding sample values.
      </div>
    );
  }

  const sampleValues = syncTemplateExampleValues(values, variables.count);

  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-medium">{label}</div>
        <Badge variant="secondary">{variables.count} sample value{variables.count === 1 ? '' : 's'}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sampleValues.map((value, index) => (
          <div key={`${label}-${index}`} className="space-y-1.5">
            <Label>Sample for {`{{${index + 1}}}`}</Label>
            <Input
              value={value}
              onChange={(event) => {
                const nextValues = [...sampleValues];
                nextValues[index] = event.target.value;
                onChange(nextValues);
              }}
              placeholder={`Example value ${index + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
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

function MediaPreviewCard({
  asset,
  format,
}: {
  asset: TemplateMediaAsset;
  format: HeaderFormat;
}) {
  const previewSourceUrl = resolveTemplateMediaSourceUrl(asset) || buildTemplateMediaPreviewUrl(asset.file_id);
  const resolvedPreviewSrc = useAuthenticatedAssetSrc(
    previewSourceUrl,
    asset.file_id || null,
    {
      fallbackSrc: isRemotePreviewUrl(asset.header_handle) ? asset.header_handle : null,
    }
  );
  const hasResolvedPreview = typeof resolvedPreviewSrc === 'string' && resolvedPreviewSrc.length > 0;
  const showsVideoThumbnail = format === 'VIDEO'
    && hasResolvedPreview
    && !asset.mime_type?.startsWith('video/')
    && looksLikeImagePreviewUrl(resolvedPreviewSrc);
  const extractedVideoPoster = useVideoPoster(format === 'VIDEO' && hasResolvedPreview && !showsVideoThumbnail ? resolvedPreviewSrc : undefined);
  const videoPosterSrc = showsVideoThumbnail ? resolvedPreviewSrc : extractedVideoPoster;
  const isImage = hasResolvedPreview && (format === 'IMAGE' || Boolean(videoPosterSrc));
  const isVideo = format === 'VIDEO' && hasResolvedPreview && !videoPosterSrc;
  const isPdfDocument = format === 'DOCUMENT'
    && hasResolvedPreview
    && (asset.mime_type === 'application/pdf' || looksLikePdfPreviewUrl(resolvedPreviewSrc));
  const Icon = format === 'VIDEO' ? Video : format === 'DOCUMENT' ? FileText : ImageIcon;
  const showsVisualPreview = isImage || isVideo || isPdfDocument;

  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {showsVisualPreview ? (
          <div className="w-full max-w-[220px] shrink-0">
            {isImage ? (
              <div className="relative overflow-hidden rounded-2xl bg-background shadow-inner">
                <img
                  src={format === 'VIDEO' ? videoPosterSrc || resolvedPreviewSrc : resolvedPreviewSrc}
                  alt={asset.original_name || 'Uploaded media preview'}
                  className="h-28 w-full object-cover"
                />
                {format === 'VIDEO' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/30 via-black/5 to-black/30">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-sm">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isVideo ? (
              <div className="overflow-hidden rounded-2xl bg-black shadow-inner">
                <video
                  src={resolvedPreviewSrc}
                  controls
                  preload="metadata"
                  className="h-28 w-full bg-black object-contain"
                />
              </div>
            ) : null}

            {isPdfDocument ? (
              <div className="overflow-hidden rounded-2xl border bg-background shadow-inner">
                <iframe
                  title={asset.original_name || 'Uploaded PDF sample'}
                  src={resolvedPreviewSrc}
                  className="h-32 w-full bg-background"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-inner">
              {!showsVisualPreview ? (
                <Icon className="h-5 w-5 text-muted-foreground" />
              ) : format === 'IMAGE' ? (
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              ) : format === 'VIDEO' ? (
                <Video className="h-5 w-5 text-muted-foreground" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{asset.original_name || 'Uploaded sample'}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[asset.mime_type || format, formatBytes(asset.size), asset.aspect_ratio || null]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {asset.width && asset.height ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {asset.width} x {asset.height}
                </div>
              ) : null}
              {format === 'DOCUMENT' && resolvedPreviewSrc && !isPdfDocument ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Inline preview is available for PDF documents. Other document formats stay downloadable for review.
                </div>
              ) : null}
              {asset.header_handle ? (
                <Badge variant="secondary" className="mt-2">Meta-ready sample</Badge>
              ) : (
                <Badge variant="outline" className="mt-2">Ready for publish upload</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeaderFields({
  headerFormat,
  headerText,
  headerTextExamples,
  headerMedia,
  onFormatChange,
  onTextChange,
  onTextExamplesChange,
  onMediaChange,
  label = 'Header',
  allowedFormats = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'],
}: {
  headerFormat: HeaderFormat;
  headerText: string;
  headerTextExamples: string[];
  headerMedia: TemplateMediaAsset | null;
  onFormatChange: (value: HeaderFormat) => void;
  onTextChange: (value: string) => void;
  onTextExamplesChange: (value: string[]) => void;
  onMediaChange: (value: TemplateMediaAsset | null) => void;
  label?: string;
  allowedFormats?: HeaderFormat[];
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadMedia = useUploadTemplateMedia();
  const isMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);
  const mediaRule = getTemplateMediaRule(headerFormat);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const clientValidationError = validateTemplateMediaFile(file, headerFormat);
    if (clientValidationError) {
      toast.error(clientValidationError);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }

    try {
      const mediaMetadata = await extractTemplateMediaMetadata(file, headerFormat);
      const uploaded = await runTemplateActionToast(uploadMedia.mutateAsync(file), {
        loading: 'Uploading header sample...',
        success: 'Header sample uploaded.',
        error: 'Failed to upload the header sample.',
      });
      const previewUrl = buildTemplateMediaPreviewUrl(uploaded.id);
      onMediaChange({
        file_id: uploaded.id,
        original_name: uploaded.original_name,
        mime_type: uploaded.mime_type,
        size: uploaded.size,
        type: uploaded.type,
        preview_url: previewUrl,
        width: mediaMetadata?.width,
        height: mediaMetadata?.height,
        aspect_ratio: mediaMetadata?.aspect_ratio,
        header_handle: null,
      });
    } catch {
      return;
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };



  return (
    <div className="rounded-[24px] border p-3.5 md:p-4">
      <div className="mb-3">
        <div className="font-semibold">{label}</div>
        <p className="text-sm text-muted-foreground">
          Match the header format to the real WhatsApp template. Media headers need a sample file for Meta review.
        </p>
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Header format</Label>
          <Select
            value={headerFormat}
            onValueChange={(value) => onFormatChange(value as HeaderFormat)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedFormats.includes('NONE') ? <SelectItem value="NONE">No header</SelectItem> : null}
              {allowedFormats.includes('TEXT') ? <SelectItem value="TEXT">Text</SelectItem> : null}
              {allowedFormats.includes('IMAGE') ? <SelectItem value="IMAGE">Image</SelectItem> : null}
              {allowedFormats.includes('VIDEO') ? <SelectItem value="VIDEO">Video</SelectItem> : null}
              {allowedFormats.includes('DOCUMENT') ? <SelectItem value="DOCUMENT">Document</SelectItem> : null}
              {allowedFormats.includes('LOCATION') ? <SelectItem value="LOCATION">Location</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>

        {headerFormat === 'TEXT' ? (
          <div className="space-y-3">
            <Label>Header text</Label>
            <Input value={headerText} onChange={(event) => onTextChange(event.target.value)} placeholder="Order update for {{1}}" />
            <TemplateVariableExamplesField
              label="Header samples"
              text={headerText}
              values={headerTextExamples}
              onChange={onTextExamplesChange}
            />
          </div>
        ) : null}

        {isMediaHeader ? (
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-3.5">
              <div>
                <div className="font-medium">Sample media upload</div>
                <p className="text-sm text-muted-foreground">{getTemplateMediaHelper(headerFormat)}</p>
                {mediaRule ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Official limit: {formatBytes(mediaRule.maxSizeBytes)} max.
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={inputId}
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept={getTemplateMediaAccept(headerFormat)}
                  onChange={handleFileChange}
                />
                <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploadMedia.isPending}>
                  {uploadMedia.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload sample
                </Button>
                {headerMedia ? (
                  <Button type="button" variant="ghost" size="icon" onClick={() => onMediaChange(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            {headerMedia ? <MediaPreviewCard asset={headerMedia} format={headerFormat} /> : null}
          </div>
        ) : null}

        {headerFormat === 'LOCATION' ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground lg:col-span-2">
            Location headers are rendered as a map card in WhatsApp and do not require a media upload.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function VariableTextareaField({
  label,
  value,
  onChange,
  examples = [],
  onExamplesChange,
  placeholder,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  examples?: string[];
  onExamplesChange?: (value: string[]) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nextToken = getNextVariableToken(value);

  const handleAddVariable = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${nextToken}${value.slice(end)}`;

    onChange(nextValue);

    requestAnimationFrame(() => {
      if (!textareaRef.current) {
        return;
      }
      const cursor = start + nextToken.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">Use variables like {`{{1}}`} for Meta samples</span>
      </div>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="pb-14"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="absolute bottom-3 right-3 rounded-full px-3 text-xs"
          onClick={handleAddVariable}
        >
          Add {nextToken}
        </Button>
      </div>
      {onExamplesChange ? (
        <TemplateVariableExamplesField
          label={`${label} samples`}
          text={value}
          values={examples}
          onChange={onExamplesChange}
        />
      ) : null}
    </div>
  );
}

export function SecurityRecommendationToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border p-4">
      <div>
        <div className="font-medium">Add security recommendation</div>
        <p className="text-sm text-muted-foreground">Include the Meta security recommendation block in the auth body.</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function StandardButtonsEditor({
  buttons,
  onChange,
  maxButtons,
  label,
}: {
  buttons: StandardButtonDraft[];
  onChange: (value: StandardButtonDraft[]) => void;
  maxButtons: number;
  label: string;
}) {
  const updateButton = (index: number, patch: Partial<StandardButtonDraft>) => {
    onChange(buttons.map((button, buttonIndex) => (buttonIndex === index ? { ...button, ...patch } : button)));
  };

  const removeButton = (index: number) => {
    onChange(buttons.filter((_, buttonIndex) => buttonIndex !== index));
  };

  return (
    <div className="rounded-[24px] border p-3.5 md:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{label}</div>
          <p className="text-sm text-muted-foreground">
            Use quick replies, website CTAs, or phone call buttons. Meta allows at most 2 URL or phone CTAs in one template, and quick replies must stay grouped together.
          </p>
        </div>
        {buttons.length < maxButtons ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(addStandardButton(buttons))}>
            <Plus className="mr-2 h-4 w-4" />
            Add button
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        {buttons.map((button, index) => (
          <div key={`${button.type}-${index}`} className="rounded-2xl border bg-muted/20 p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-medium">Button {index + 1}</div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeButton(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Button type</Label>
                <Select
                  value={button.type}
                  onValueChange={(value) =>
                    updateButton(index, {
                      type: value as StandardButtonDraft['type'],
                      url: value === 'URL' ? button.url : '',
                      phone_number: value === 'PHONE_NUMBER' ? button.phone_number : '',
                      example: value === 'URL' ? button.example : [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="QUICK_REPLY">Quick reply</SelectItem>
                    <SelectItem value="URL">Visit website</SelectItem>
                    <SelectItem value="PHONE_NUMBER">Call phone number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Button text</Label>
                <Input value={button.text} onChange={(event) => updateButton(index, { text: event.target.value })} placeholder="Track order" />
              </div>
            </div>
            {button.type === 'URL' ? (
              <div className="mt-4 space-y-3">
                <Label>Destination URL</Label>
                <Input value={button.url} onChange={(event) => updateButton(index, { url: event.target.value })} placeholder="https://example.com/orders/{{1}}" />
                <p className="text-xs text-muted-foreground">
                  Meta supports one optional URL variable only, and it must be appended at the very end as {'{{1}}'}.
                </p>
                <TemplateVariableExamplesField
                  label="URL samples"
                  text={button.url}
                  values={button.example}
                  onChange={(value) => updateButton(index, { example: value })}
                />
              </div>
            ) : null}
            {button.type === 'PHONE_NUMBER' ? (
              <div className="mt-4 space-y-2">
                <Label>Phone number</Label>
                <PhoneNumberInput
                  value={button.phone_number}
                  onChange={(value) => updateButton(index, { phone_number: value })}
                  placeholder="Enter phone number"
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
