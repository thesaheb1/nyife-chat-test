import { useId, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Loader2,
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
import { getApiErrorMessage } from '@/core/errors/apiError';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';
import type {
  HeaderFormat,
  StandardButtonDraft,
  TemplateMediaAsset,
} from './templateBuilder';
import { addStandardButton } from './templateBuilder';
import type { ValidationIssue } from './templateComposerUtils';
import {
  extractTemplateMediaMetadata,
  formatBytes,
  getTemplateMediaAccept,
  getTemplateMediaHelper,
  getTemplateMediaRule,
  validateTemplateMediaFile,
} from './templateMediaRules';
import { useUploadTemplateMedia } from './useTemplates';

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}

export function SectionIssueList({ title, issues }: { title: string; issues: ValidationIssue[] }) {
  if (!issues.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
      <div className="mb-2 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-1 text-amber-800 dark:text-amber-200">
        {issues.map((issue) => (
          <p key={`${issue.path}:${issue.message}`}>{issue.message}</p>
        ))}
      </div>
    </div>
  );
}

export function ValidationSummary({
  valid,
  issueCount,
}: {
  valid: boolean;
  issueCount: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-4">
      {valid ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-amber-600" />
      )}
      <div>
        <div className="font-medium">{valid ? 'Ready for save or update' : 'Validation required'}</div>
        <div className="text-sm text-muted-foreground">
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
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40 hover:bg-muted/40'
        }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{title}</div>
        {active ? <Badge>Selected</Badge> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function getNextVariableToken(value: string) {
  const matches = Array.from(value.matchAll(/\{\{(\d+)\}\}/g));
  const highest = matches.reduce((max, match) => Math.max(max, Number(match[1] || 0)), 0);
  return `{{${highest + 1}}}`;
}

function MediaPreviewCard({
  asset,
  format,
}: {
  asset: TemplateMediaAsset;
  format: HeaderFormat;
}) {
  const isImage = format === 'IMAGE' && asset.preview_url;
  const Icon = format === 'VIDEO' ? Video : format === 'DOCUMENT' ? FileText : ImageIcon;

  return (
    <div className="rounded-2xl border bg-muted/20 p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-inner">
          {isImage ? (
            <img src={asset.preview_url} alt={asset.original_name} className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-6 w-6 text-muted-foreground" />
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
          {asset.header_handle ? (
            <Badge variant="secondary" className="mt-2">Meta-ready sample</Badge>
          ) : (
            <Badge variant="outline" className="mt-2">Ready for publish upload</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function HeaderFields({
  headerFormat,
  headerText,
  headerMedia,
  onFormatChange,
  onTextChange,
  onMediaChange,
  label = 'Header',
}: {
  headerFormat: HeaderFormat;
  headerText: string;
  headerMedia: TemplateMediaAsset | null;
  onFormatChange: (value: HeaderFormat) => void;
  onTextChange: (value: string) => void;
  onMediaChange: (value: TemplateMediaAsset | null) => void;
  label?: string;
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
      const uploaded = await uploadMedia.mutateAsync(file);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
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
      toast.success('Header sample uploaded.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to upload the header sample.'));
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div className="rounded-3xl border p-4">
      <div className="mb-4">
        <div className="font-semibold">{label}</div>
        <p className="text-sm text-muted-foreground">
          Match the header format to the real WhatsApp template. Media headers need a sample file for Meta review.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
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
              <SelectItem value="NONE">No header</SelectItem>
              <SelectItem value="TEXT">Text</SelectItem>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="VIDEO">Video</SelectItem>
              <SelectItem value="DOCUMENT">Document</SelectItem>
              <SelectItem value="LOCATION">Location</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {headerFormat === 'TEXT' ? (
          <div className="space-y-2">
            <Label>Header text</Label>
            <Input value={headerText} onChange={(event) => onTextChange(event.target.value)} placeholder="Order update for {{1}}" />
          </div>
        ) : null}

        {isMediaHeader ? (
          <div className="space-y-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed p-4">
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
  placeholder,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
    <div className="rounded-2xl border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{label}</div>
          <p className="text-sm text-muted-foreground">
            Use quick replies, website CTAs, or phone call buttons. Meta allows at most 2 URL or phone CTAs in one template.
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
          <div key={`${button.type}-${index}`} className="rounded-2xl border bg-muted/20 p-4">
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
              <div className="mt-4 space-y-2">
                <Label>Destination URL</Label>
                <Input value={button.url} onChange={(event) => updateButton(index, { url: event.target.value })} placeholder="https://example.com/orders/{{1}}" />
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
