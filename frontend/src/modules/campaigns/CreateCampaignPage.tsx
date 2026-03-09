import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCampaign } from './useCampaigns';
import { createCampaignSchema } from './validations';
import type { CreateCampaignFormData } from './validations';
import { useTemplates } from '@/modules/templates/useTemplates';
import {
  buildActiveWhatsAppAccountOptions,
  findWhatsAppAccount,
  getWhatsAppAccountLabel,
} from '@/modules/whatsapp/accountOptions';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const { data: waAccounts } = useWhatsAppAccounts();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCampaignFormData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      type: 'immediate',
      target_type: 'all',
      target_config: {},
    },
  });

  const campaignType = watch('type');
  const targetType = watch('target_type');
  const selectedWaAccountId = watch('wa_account_id');
  const selectedTemplateId = watch('template_id');
  const selectedWaAccount = useMemo(
    () => findWhatsAppAccount(waAccounts, selectedWaAccountId),
    [selectedWaAccountId, waAccounts]
  );
  const activeAccountOptions = useMemo(() => buildActiveWhatsAppAccountOptions(waAccounts), [waAccounts]);

  const { data: templatesData } = useTemplates({
    status: 'approved',
    limit: 100,
    waba_id: selectedWaAccount?.waba_id || undefined,
  });
  const templates = templatesData?.data?.templates ?? [];

  // Tag/group IDs as comma-separated inputs
  const [groupIdsInput, setGroupIdsInput] = useState('');
  const [contactIdsInput, setContactIdsInput] = useState('');
  const [tagIdsInput, setTagIdsInput] = useState('');
  const [excludeTagIdsInput, setExcludeTagIdsInput] = useState('');

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }

    const stillValid = templates.some((template) => template.id === selectedTemplateId);
    if (!stillValid) {
      setValue('template_id', '', { shouldValidate: true });
    }
  }, [selectedTemplateId, setValue, templates]);

  const parseIds = (input: string) =>
    input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const onSubmit = async (data: CreateCampaignFormData) => {
    // Build target_config from inputs
    const target_config: Record<string, string[]> = {};
    if (targetType === 'group' && groupIdsInput) target_config.group_ids = parseIds(groupIdsInput);
    if (targetType === 'contacts' && contactIdsInput) target_config.contact_ids = parseIds(contactIdsInput);
    if (targetType === 'tags' && tagIdsInput) target_config.tag_ids = parseIds(tagIdsInput);
    if (excludeTagIdsInput) target_config.exclude_tag_ids = parseIds(excludeTagIdsInput);

    try {
      await createCampaign.mutateAsync({ ...data, target_config });
      toast.success('Campaign created successfully');
      navigate('/campaigns');
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create campaign';
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Campaign</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input {...register('name')} placeholder="e.g., Black Friday Sale 2026" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...register('description')} placeholder="Campaign description (optional)" rows={3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>WhatsApp Account *</Label>
                <Select
                  value={selectedWaAccountId || ''}
                  onValueChange={(value) => {
                    setValue('wa_account_id', value, { shouldValidate: true });
                    setValue('template_id', '', { shouldValidate: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccountOptions.map((account) => (
                      <SelectItem key={account.value} value={account.value}>
                        {account.label}
                      </SelectItem>
                    ))}
                    {activeAccountOptions.length === 0 && (
                      <SelectItem value="none" disabled>
                        No active accounts connected
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.wa_account_id && <p className="text-sm text-destructive">{errors.wa_account_id.message}</p>}
                {selectedWaAccount ? (
                  <p className="text-xs text-muted-foreground">
                    {getWhatsAppAccountLabel(selectedWaAccount)} / WABA {selectedWaAccount.waba_id}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose the connected account first. The template list is filtered to that account's WABA.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Template *</Label>
                <Select
                  value={selectedTemplateId || ''}
                  onValueChange={(value) => setValue('template_id', value, { shouldValidate: true })}
                  disabled={!selectedWaAccount}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedWaAccount ? 'Select template' : 'Select account first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span>{t.display_name || t.name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {t.category}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                    {templates.length === 0 && (
                      <SelectItem value="none" disabled>
                        {selectedWaAccount ? 'No approved templates for this account' : 'Select an account first'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.template_id && <p className="text-sm text-destructive">{errors.template_id.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scheduling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Type</Label>
              <Select
                value={campaignType}
                onValueChange={(v) => setValue('type', v as 'immediate' | 'scheduled')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Send Immediately</SelectItem>
                  <SelectItem value="scheduled">Schedule for Later</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {campaignType === 'scheduled' && (
              <div className="space-y-2">
                <Label>Scheduled Date & Time *</Label>
                <Input
                  type="datetime-local"
                  {...register('scheduled_at')}
                  min={new Date().toISOString().slice(0, 16)}
                />
                {errors.scheduled_at && <p className="text-sm text-destructive">{errors.scheduled_at.message}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audience */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Type</Label>
              <Select
                value={targetType}
                onValueChange={(v) => setValue('target_type', v as CreateCampaignFormData['target_type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="contacts">Specific Contacts</SelectItem>
                  <SelectItem value="group">Contact Groups</SelectItem>
                  <SelectItem value="tags">Contact Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === 'contacts' && (
              <div className="space-y-2">
                <Label>Contact IDs</Label>
                <Textarea
                  value={contactIdsInput}
                  onChange={(e) => setContactIdsInput(e.target.value)}
                  placeholder="Paste contact IDs separated by commas"
                  rows={3}
                />
                {contactIdsInput && (
                  <div className="flex flex-wrap gap-1">
                    {parseIds(contactIdsInput).map((id) => (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {id.slice(0, 8)}...
                        <button
                          type="button"
                          className="ml-1"
                          onClick={() =>
                            setContactIdsInput(
                              parseIds(contactIdsInput)
                                .filter((i) => i !== id)
                                .join(', ')
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {targetType === 'group' && (
              <div className="space-y-2">
                <Label>Group IDs</Label>
                <Input
                  value={groupIdsInput}
                  onChange={(e) => setGroupIdsInput(e.target.value)}
                  placeholder="Group IDs separated by commas"
                />
              </div>
            )}

            {targetType === 'tags' && (
              <div className="space-y-2">
                <Label>Tag IDs</Label>
                <Input
                  value={tagIdsInput}
                  onChange={(e) => setTagIdsInput(e.target.value)}
                  placeholder="Tag IDs separated by commas"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Exclude Tags (Optional)</Label>
              <Input
                value={excludeTagIdsInput}
                onChange={(e) => setExcludeTagIdsInput(e.target.value)}
                placeholder="Tag IDs to exclude, separated by commas"
              />
            </div>
          </CardContent>
        </Card>

        {/* Variables */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Variable Mapping (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Map template variables (e.g., {"{{1}}"}) to contact fields (e.g., "name", "phone", "company").
            </p>
            <VariableMappingInput
              onChange={(mapping) => {
                if (Object.keys(mapping).length > 0) {
                  setValue('variables_mapping', mapping);
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/campaigns')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createCampaign.isPending}>
            {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </div>
      </form>
    </div>
  );
}

function VariableMappingInput({ onChange }: { onChange: (m: Record<string, string>) => void }) {
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  const update = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    setRows(updated);
    const mapping: Record<string, string> = {};
    updated.forEach((r) => {
      if (r.key && r.value) mapping[r.key] = r.value;
    });
    onChange(mapping);
  };

  const addRow = () => setRows([...rows, { key: '', value: '' }]);
  const removeRow = (index: number) => {
    const updated = rows.filter((_, i) => i !== index);
    setRows(updated.length === 0 ? [{ key: '', value: '' }] : updated);
    const mapping: Record<string, string> = {};
    updated.forEach((r) => {
      if (r.key && r.value) mapping[r.key] = r.value;
    });
    onChange(mapping);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={row.key}
            onChange={(e) => update(idx, 'key', e.target.value)}
            placeholder="Variable (e.g., 1)"
            className="h-8 w-32"
          />
          <span className="text-muted-foreground">&rarr;</span>
          <Input
            value={row.value}
            onChange={(e) => update(idx, 'value', e.target.value)}
            placeholder="Contact field (e.g., name)"
            className="h-8 flex-1"
          />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(idx)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        + Add Variable
      </Button>
    </div>
  );
}
