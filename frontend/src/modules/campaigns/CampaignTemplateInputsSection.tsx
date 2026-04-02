import { useRef, type ChangeEvent } from 'react';
import { FileText, Image as ImageIcon, Loader2, MapPin, Package, Upload, Video, X } from 'lucide-react';
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
import type { CampaignLocationBinding, CampaignMediaBinding, CampaignProductBinding } from '@/core/types';
import { useUploadTemplateMedia } from '@/modules/templates/useTemplates';
import {
  extractTemplateMediaMetadata,
  formatBytes,
  getTemplateMediaAccept,
  getTemplateMediaHelper,
  getTemplateMediaRule,
  validateTemplateMediaFile,
} from '@/modules/templates/templateMediaRules';
import type {
  CampaignLocationField,
  CampaignMediaField,
  CampaignProductField,
  CampaignVariableBinding,
  CampaignVariableField,
  CampaignVariableSource,
} from './campaignTemplateVariables';

const DYNAMIC_VALUE_OPTIONS: Array<{ value: CampaignVariableSource; label: string }> = [
  { value: 'full_name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

function buildCampaignMediaPreviewUrl(fileId: string) {
  return `/api/v1/media/${encodeURIComponent(fileId)}/download`;
}

function MediaPreview({
  binding,
}: {
  binding: CampaignMediaBinding;
}) {
  if (binding.media_type === 'image' && binding.preview_url) {
    return (
      <img
        src={binding.preview_url}
        alt={binding.original_name}
        className="h-36 w-full rounded-xl object-cover"
      />
    );
  }

  if (binding.media_type === 'video' && binding.preview_url) {
    return (
      <video
        src={binding.preview_url}
        className="h-36 w-full rounded-xl bg-muted object-cover"
        controls
        preload="metadata"
      />
    );
  }

  const Icon = binding.media_type === 'video' ? Video : binding.media_type === 'document' ? FileText : ImageIcon;
  return (
    <div className="flex h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 px-4 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
      <div className="line-clamp-2 text-sm font-medium">{binding.original_name}</div>
      <div className="mt-1 text-xs text-muted-foreground">{binding.mime_type}</div>
    </div>
  );
}

function formatCoordinate(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function parseCoordinate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function CampaignMediaInputCard({
  field,
  binding,
  onChange,
}: {
  field: CampaignMediaField;
  binding?: CampaignMediaBinding;
  onChange: (nextBinding: CampaignMediaBinding | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadMedia = useUploadTemplateMedia();
  const mediaRule = getTemplateMediaRule(field.format);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const clientValidationError = validateTemplateMediaFile(file, field.format);
    if (clientValidationError) {
      toast.error(clientValidationError);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }

    try {
      await extractTemplateMediaMetadata(file, field.format);
      const uploaded = await uploadMedia.mutateAsync(file);
      onChange({
        file_id: uploaded.id,
        media_type: field.mediaType,
        original_name: uploaded.original_name,
        mime_type: uploaded.mime_type,
        size: uploaded.size,
        preview_url: buildCampaignMediaPreviewUrl(uploaded.id),
      });
      toast.success(`${field.label} uploaded successfully.`);
    } catch (error) {
      console.error('[campaigns] Failed to upload campaign media:', error);
      toast.error(`Failed to upload ${field.label.toLowerCase()}.`);
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium">{field.label}</div>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{field.format}</Badge>
          <Badge variant="outline">{field.key}</Badge>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-dashed p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Upload media</div>
            <p className="text-sm text-muted-foreground">{getTemplateMediaHelper(field.format)}</p>
            {mediaRule ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Official limit: {formatBytes(mediaRule.maxSizeBytes)} max.
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={getTemplateMediaAccept(field.format)}
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploadMedia.isPending}
            >
              {uploadMedia.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {binding ? 'Replace file' : 'Upload file'}
            </Button>
            {binding ? (
              <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {binding ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <MediaPreview binding={binding} />
            <div className="space-y-2">
              <div className="font-medium">{binding.original_name}</div>
              <div className="text-sm text-muted-foreground">{binding.mime_type}</div>
              <div className="text-sm text-muted-foreground">{formatBytes(binding.size)}</div>
              <div className="text-xs text-muted-foreground break-all">{binding.file_id}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Upload the file that should be used for this template header before saving the campaign.
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignLocationInputCard({
  field,
  binding,
  onChange,
}: {
  field: CampaignLocationField;
  binding?: CampaignLocationBinding;
  onChange: (nextBinding: CampaignLocationBinding | null) => void;
}) {
  const nextBinding = binding || {};

  const updateBinding = (changes: Partial<CampaignLocationBinding>) => {
    const merged = {
      ...nextBinding,
      ...changes,
    };

    if (
      merged.latitude === undefined
      && merged.longitude === undefined
      && !merged.name
      && !merged.address
    ) {
      onChange(null);
      return;
    }

    onChange(merged);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium">{field.label}</div>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">LOCATION</Badge>
          <Badge variant="outline">{field.key}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${field.key}-latitude`}>Latitude</Label>
          <Input
            id={`${field.key}-latitude`}
            inputMode="decimal"
            placeholder="e.g. 28.6139"
            value={formatCoordinate(binding?.latitude)}
            onChange={(event) => updateBinding({ latitude: parseCoordinate(event.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${field.key}-longitude`}>Longitude</Label>
          <Input
            id={`${field.key}-longitude`}
            inputMode="decimal"
            placeholder="e.g. 77.2090"
            value={formatCoordinate(binding?.longitude)}
            onChange={(event) => updateBinding({ longitude: parseCoordinate(event.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${field.key}-name`}>Location Name</Label>
          <Input
            id={`${field.key}-name`}
            placeholder="Optional label shown with the location"
            value={binding?.name || ''}
            onChange={(event) => updateBinding({ name: event.target.value || undefined })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${field.key}-address`}>Address</Label>
          <Input
            id={`${field.key}-address`}
            placeholder="Optional address text"
            value={binding?.address || ''}
            onChange={(event) => updateBinding({ address: event.target.value || undefined })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
        Use the exact location that should be attached to this template message header. Latitude and longitude are required.
      </div>
    </div>
  );
}

function CampaignProductInputCard({
  field,
  binding,
  onChange,
}: {
  field: CampaignProductField;
  binding?: CampaignProductBinding;
  onChange: (nextBinding: CampaignProductBinding | null) => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium">{field.label}</div>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">PRODUCT</Badge>
          <Badge variant="outline">{field.key}</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${field.key}-product-retailer-id`}>Product Retailer ID</Label>
        <Input
          id={`${field.key}-product-retailer-id`}
          placeholder="Enter the exact Meta catalog product retailer ID"
          value={binding?.product_retailer_id || ''}
          onChange={(event) => {
            const productRetailerId = event.target.value.trim();
            onChange(
              productRetailerId
                ? { product_retailer_id: productRetailerId }
                : null
            );
          }}
        />
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
        Use a valid product retailer ID from the Meta catalog linked to this WhatsApp Business account. Each required product card needs its own product retailer ID.
      </div>
    </div>
  );
}

export function CampaignTemplateInputsSection({
  variableFields,
  mediaFields,
  locationFields,
  productFields,
  variableBindings,
  mediaBindings,
  locationBindings,
  productBindings,
  onVariableBindingChange,
  onMediaBindingChange,
  onLocationBindingChange,
  onProductBindingChange,
  showIncompleteError,
}: {
  variableFields: CampaignVariableField[];
  mediaFields: CampaignMediaField[];
  locationFields: CampaignLocationField[];
  productFields: CampaignProductField[];
  variableBindings: Record<string, CampaignVariableBinding>;
  mediaBindings: Record<string, CampaignMediaBinding>;
  locationBindings: Record<string, CampaignLocationBinding>;
  productBindings: Record<string, CampaignProductBinding>;
  onVariableBindingChange: (key: string, binding: CampaignVariableBinding) => void;
  onMediaBindingChange: (key: string, binding: CampaignMediaBinding | null) => void;
  onLocationBindingChange: (key: string, binding: CampaignLocationBinding | null) => void;
  onProductBindingChange: (key: string, binding: CampaignProductBinding | null) => void;
  showIncompleteError: boolean;
}) {
  if (
    variableFields.length === 0
    && mediaFields.length === 0
    && locationFields.length === 0
    && productFields.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        This template needs runtime inputs. Configure every text variable, upload every required media file, add every required location detail, and fill every required product reference before saving the campaign.
      </p>

      {variableFields.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm font-medium">Text variables</div>
          {variableFields.map((field) => {
            const binding = variableBindings[field.key];

            return (
              <div key={field.key} className="space-y-4 rounded-2xl border border-border/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">{field.label}</div>
                    <p className="text-xs text-muted-foreground">{field.hint}</p>
                  </div>
                  <Badge variant="outline">{field.key}</Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label>Value Type</Label>
                    <Select
                      value={binding?.mode || ''}
                      onValueChange={(value) => {
                        if (value === 'static') {
                          onVariableBindingChange(field.key, { mode: 'static', value: '' });
                        }

                        if (value === 'dynamic') {
                          onVariableBindingChange(field.key, { mode: 'dynamic', source: 'full_name' });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose value type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="static">Static value</SelectItem>
                        <SelectItem value="dynamic">Dynamic value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{binding?.mode === 'dynamic' ? 'Dynamic Source' : 'Static Value'}</Label>
                    {binding?.mode === 'dynamic' ? (
                      <Select
                        value={binding.source || 'full_name'}
                        onValueChange={(value) =>
                          onVariableBindingChange(field.key, {
                            mode: 'dynamic',
                            source: value as CampaignVariableSource,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DYNAMIC_VALUE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : binding?.mode === 'static' ? (
                      <Input
                        value={binding.value || ''}
                        onChange={(event) =>
                          onVariableBindingChange(field.key, {
                            mode: 'static',
                            value: event.target.value,
                          })
                        }
                        placeholder="Enter the exact value to send"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        Choose how this variable should be populated before saving the campaign.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {mediaFields.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm font-medium">Media headers</div>
          {mediaFields.map((field) => (
            <CampaignMediaInputCard
              key={field.key}
              field={field}
              binding={mediaBindings[field.key]}
              onChange={(binding) => onMediaBindingChange(field.key, binding)}
            />
          ))}
        </div>
      ) : null}

      {locationFields.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            Location headers
          </div>
          {locationFields.map((field) => (
            <CampaignLocationInputCard
              key={field.key}
              field={field}
              binding={locationBindings[field.key]}
              onChange={(binding) => onLocationBindingChange(field.key, binding)}
            />
          ))}
        </div>
      ) : null}

      {productFields.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            Product headers
          </div>
          {productFields.map((field) => (
            <CampaignProductInputCard
              key={field.key}
              field={field}
              binding={productBindings[field.key]}
              onChange={(binding) => onProductBindingChange(field.key, binding)}
            />
          ))}
        </div>
      ) : null}

      {showIncompleteError ? (
        <p className="text-sm text-destructive">
          Complete every required template input before saving the campaign.
        </p>
      ) : null}
    </div>
  );
}
