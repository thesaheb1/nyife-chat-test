import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useDebounce } from '@/core/hooks';
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
import { getApiErrorMessage } from '@/core/errors/apiError';
import { createCampaignSchema } from './validations';
import type { CreateCampaignFormData } from './validations';
import { CampaignOptionPicker, type CampaignPickerOption } from './CampaignOptionPicker';
import {
  areCampaignVariableBindingsComplete,
  extractCampaignTemplateVariables,
  pruneCampaignVariableBindings,
  type CampaignVariableBinding,
  type CampaignVariableSource,
} from './campaignTemplateVariables';
import { useTemplates } from '@/modules/templates/useTemplates';
import {
  buildActivePhoneNumberOptions,
  findWhatsAppAccount,
  getWhatsAppPhoneNumberLabel,
} from '@/modules/whatsapp/accountOptions';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { useContacts, useGroups, useTags } from '@/modules/contacts/useContacts';
import { hasFilledValue, useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';
import type { Contact, Group, Tag, Template } from '@/core/types';

type CampaignTargetType = CreateCampaignFormData['target_type'];
type OptionMap = Record<string, CampaignPickerOption>;

const PAGE_SIZE = 12;
const DYNAMIC_VALUE_OPTIONS: Array<{ value: CampaignVariableSource; label: string }> = [
  { value: 'full_name', label: 'Full name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

function toggleOptionMap(current: OptionMap, option: CampaignPickerOption) {
  const next = { ...current };

  if (next[option.value]) {
    delete next[option.value];
  } else {
    next[option.value] = option;
  }

  return next;
}

function removeOptionFromMap(current: OptionMap, optionValue: string) {
  const next = { ...current };
  delete next[optionValue];
  return next;
}

function clearOptionMap() {
  return {};
}

function toOptionArray(map: OptionMap) {
  return Object.values(map);
}

function buildTargetConfig(
  targetType: CampaignTargetType,
  selectedContacts: OptionMap,
  excludedContacts: OptionMap,
  selectedGroups: OptionMap,
  selectedTags: OptionMap
) {
  switch (targetType) {
    case 'contacts':
      return { contact_ids: Object.keys(selectedContacts) };
    case 'group':
      return { group_ids: Object.keys(selectedGroups) };
    case 'tags':
      return { tag_ids: Object.keys(selectedTags) };
    case 'all':
    default:
      return Object.keys(excludedContacts).length
        ? { exclude_contact_ids: Object.keys(excludedContacts) }
        : {};
  }
}

function formatDateTimeLocalMin(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildTemplateOption(template: Template): CampaignPickerOption {
  return {
    value: template.id,
    label: template.display_name || template.name,
    description: template.display_name ? template.name : `${template.type} template`,
    meta: `${template.type} · ${template.language}`,
    badge: template.category,
  };
}

function buildContactOption(contact: Contact): CampaignPickerOption {
  return {
    value: contact.id,
    label: contact.name || contact.whatsapp_name || contact.phone,
    description: contact.email || contact.company || 'Contact from your audience list',
    meta: contact.phone,
  };
}

function buildGroupOption(group: Group): CampaignPickerOption {
  return {
    value: group.id,
    label: group.name,
    description: group.description || `${group.contact_count} member(s) ready for campaigns`,
    meta: `${group.contact_count} members`,
    badge: group.type,
  };
}

function buildTagOption(tag: Tag): CampaignPickerOption {
  return {
    value: tag.id,
    label: tag.name,
    description: `${tag.contact_count ?? 0} tagged contact(s)`,
  };
}

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const { data: waAccounts } = useWhatsAppAccounts();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitted },
  } = useForm<CreateCampaignFormData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      type: 'immediate',
      target_type: 'all',
      target_config: {},
    },
    mode: 'onChange',
  });

  const campaignType = watch('type');
  const targetType = watch('target_type');
  const selectedWaAccountId = watch('wa_account_id');
  const selectedTemplateId = watch('template_id');
  const selectedWaAccount = useMemo(
    () => findWhatsAppAccount(waAccounts, selectedWaAccountId),
    [selectedWaAccountId, waAccounts]
  );
  const activeAccountOptions = useMemo(() => buildActivePhoneNumberOptions(waAccounts), [waAccounts]);
  const requiredFieldsFilled = useRequiredFieldsFilled(control, [
    'name',
    'wa_account_id',
    'template_id',
    {
      name: 'scheduled_at',
      isFilled: (value, values) => values.type !== 'scheduled' || hasFilledValue(value),
    },
  ]);

  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const debouncedTemplateSearch = useDebounce(templateSearch, 300);

  const [contactSearch, setContactSearch] = useState('');
  const [contactPage, setContactPage] = useState(1);
  const debouncedContactSearch = useDebounce(contactSearch, 300);

  const [groupSearch, setGroupSearch] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const debouncedGroupSearch = useDebounce(groupSearch, 300);

  const [tagSearch, setTagSearch] = useState('');
  const [tagPage, setTagPage] = useState(1);
  const debouncedTagSearch = useDebounce(tagSearch, 300);

  const [selectedContacts, setSelectedContacts] = useState<OptionMap>({});
  const [excludedContacts, setExcludedContacts] = useState<OptionMap>({});
  const [selectedGroups, setSelectedGroups] = useState<OptionMap>({});
  const [selectedTags, setSelectedTags] = useState<OptionMap>({});
  const [variableBindings, setVariableBindings] = useState<Record<string, CampaignVariableBinding>>({});

  const { data: templatesData, isLoading: templatesLoading } = useTemplates({
    page: templatePage,
    limit: PAGE_SIZE,
    search: debouncedTemplateSearch || undefined,
    status: 'approved',
    published_only: true,
    waba_id: selectedWaAccount?.waba_id || undefined,
  });
  const contactsQuery = useContacts({
    page: contactPage,
    limit: PAGE_SIZE,
    search: debouncedContactSearch || undefined,
  });
  const groupsQuery = useGroups({
    page: groupPage,
    limit: PAGE_SIZE,
    search: debouncedGroupSearch || undefined,
  });
  const tagsQuery = useTags({
    page: tagPage,
    limit: PAGE_SIZE,
    search: debouncedTagSearch || undefined,
  });

  const templates = templatesData?.data?.templates ?? [];
  const templatesMeta = templatesData?.meta;
  const templateOptions = useMemo(() => templates.map(buildTemplateOption), [templates]);

  const contactOptions = useMemo(
    () => (contactsQuery.data?.data.contacts ?? []).map(buildContactOption),
    [contactsQuery.data?.data.contacts]
  );
  const contactsMeta = contactsQuery.data?.meta;

  const groupOptions = useMemo(
    () => (groupsQuery.data?.data.groups ?? []).map(buildGroupOption),
    [groupsQuery.data?.data.groups]
  );
  const groupsMeta = groupsQuery.data?.meta;

  const tagOptions = useMemo(
    () => (tagsQuery.data?.data.tags ?? []).map(buildTagOption),
    [tagsQuery.data?.data.tags]
  );
  const tagsMeta = tagsQuery.data?.meta;

  const variableFields = useMemo(
    () => extractCampaignTemplateVariables(selectedTemplate),
    [selectedTemplate]
  );
  const variableBindingsComplete = useMemo(
    () => areCampaignVariableBindingsComplete(variableFields, variableBindings),
    [variableBindings, variableFields]
  );

  const targetConfig = useMemo(
    () => buildTargetConfig(targetType, selectedContacts, excludedContacts, selectedGroups, selectedTags),
    [excludedContacts, selectedContacts, selectedGroups, selectedTags, targetType]
  );
  const audienceSelectionFilled = useMemo(() => {
    switch (targetType) {
      case 'contacts':
        return Object.keys(selectedContacts).length > 0;
      case 'group':
        return Object.keys(selectedGroups).length > 0;
      case 'tags':
        return Object.keys(selectedTags).length > 0;
      case 'all':
      default:
        return true;
    }
  }, [excludedContacts, selectedContacts, selectedGroups, selectedTags, targetType]);

  useEffect(() => {
    setValue('target_config', targetConfig, {
      shouldValidate: true,
    });
  }, [setValue, targetConfig]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplate(null);
      setVariableBindings({});
      setValue('variables_mapping', undefined, { shouldValidate: true });
      return;
    }

    const matchingTemplate = templates.find((template) => template.id === selectedTemplateId);
    if (matchingTemplate) {
      setSelectedTemplate(matchingTemplate);
    }
  }, [selectedTemplateId, setValue, templates]);

  useEffect(() => {
    setTemplateSearch('');
    setTemplatePage(1);
    setSelectedTemplate(null);
    setVariableBindings({});
    setValue('template_id', '', { shouldValidate: true });
    setValue('variables_mapping', undefined, { shouldValidate: true });
  }, [selectedWaAccountId, setValue]);

  useEffect(() => {
    setVariableBindings((current) => {
      const prunedBindings = pruneCampaignVariableBindings(current, variableFields);
      setValue(
        'variables_mapping',
        Object.keys(prunedBindings).length > 0 ? prunedBindings : undefined,
        { shouldValidate: true }
      );
      return prunedBindings;
    });
  }, [setValue, variableFields]);

  const isSubmitDisabled =
    createCampaign.isPending
    || !requiredFieldsFilled
    || !audienceSelectionFilled
    || (variableFields.length > 0 && !variableBindingsComplete)
    || Object.keys(errors).length > 0;

  const templatePickerSelected = useMemo(
    () => (selectedTemplate ? [buildTemplateOption(selectedTemplate)] : []),
    [selectedTemplate]
  );

  const updateVariableBinding = (key: string, nextBinding: CampaignVariableBinding) => {
    setVariableBindings((current) => {
      const next = {
        ...current,
        [key]: nextBinding,
      };

      setValue('variables_mapping', next, { shouldValidate: true });
      return next;
    });
  };

  const onSubmit = async (data: CreateCampaignFormData) => {
    const payload: CreateCampaignFormData = {
      ...data,
      target_config: targetConfig,
      variables_mapping: variableFields.length > 0 ? variableBindings : undefined,
    };

    try {
      await createCampaign.mutateAsync(payload);
      toast.success('Campaign created successfully');
      navigate('/campaigns');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create campaign.'));
    }
  };

  const audienceErrorMessage = useMemo(() => {
    if (!isSubmitted || audienceSelectionFilled) {
      return null;
    }

    switch (targetType) {
      case 'contacts':
        return 'Select at least one contact.';
      case 'group':
        return 'Select at least one group.';
      case 'tags':
        return 'Select at least one tag.';
      default:
        return null;
    }
  }, [audienceSelectionFilled, isSubmitted, targetType]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Campaign</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label required>Campaign Name</Label>
              <Input {...register('name')} placeholder="e.g., Black Friday Sale 2026" />
              {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...register('description')} placeholder="Campaign description (optional)" rows={3} />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="space-y-2">
                <Label required>Phone number</Label>
                <Select
                  value={selectedWaAccountId || ''}
                  onValueChange={(value) => setValue('wa_account_id', value, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select phone number" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccountOptions.map((account) => (
                      <SelectItem key={account.value} value={account.value}>
                        {account.label}
                      </SelectItem>
                    ))}
                    {activeAccountOptions.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No active phone numbers connected
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {errors.wa_account_id ? <p className="text-sm text-destructive">{errors.wa_account_id.message}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {selectedWaAccount
                    ? getWhatsAppPhoneNumberLabel(selectedWaAccount)
                    : 'Choose the connected phone number first. Nyife will use this number for the selected template automatically.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label required>Template</Label>
                <CampaignOptionPicker
                  mode="single"
                  title="Select campaign template"
                  description="Only approved Meta-published templates that belong to the selected WhatsApp account/WABA are shown here."
                  placeholder={selectedWaAccount ? 'Select template' : 'Select phone number first'}
                  searchPlaceholder="Search approved templates"
                  emptyMessage={selectedWaAccount ? 'No approved and published templates matched your search.' : 'Select a phone number first.'}
                  options={templateOptions}
                  selectedOptions={templatePickerSelected}
                  search={templateSearch}
                  page={templatePage}
                  totalPages={templatesMeta?.totalPages ?? 0}
                  totalCount={templatesMeta?.total}
                  disabled={!selectedWaAccount}
                  isLoading={templatesLoading}
                  onSearchChange={setTemplateSearch}
                  onPageChange={setTemplatePage}
                  onSelect={(option) => {
                    const template = templates.find((item) => item.id === option.value);
                    if (!template) {
                      return;
                    }

                    setSelectedTemplate(template);
                    setValue('template_id', template.id, { shouldValidate: true });
                    setTemplateSearch('');
                    setTemplatePage(1);
                  }}
                  onRemove={() => {
                    setSelectedTemplate(null);
                    setVariableBindings({});
                    setValue('template_id', '', { shouldValidate: true });
                    setValue('variables_mapping', undefined, { shouldValidate: true });
                  }}
                />
                {errors.template_id ? <p className="text-sm text-destructive">{errors.template_id.message}</p> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scheduling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label required>Campaign Type</Label>
              <Select
                value={campaignType}
                onValueChange={(value) =>
                  setValue('type', value as CreateCampaignFormData['type'], {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
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

            {campaignType === 'scheduled' ? (
              <div className="space-y-2">
                <Label required>Scheduled Date & Time</Label>
                <Input
                  type="datetime-local"
                  {...register('scheduled_at')}
                  min={formatDateTimeLocalMin()}
                />
                {errors.scheduled_at ? <p className="text-sm text-destructive">{errors.scheduled_at.message}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label required>Target Type</Label>
              <Select
                value={targetType}
                onValueChange={(value) =>
                  setValue('target_type', value as CampaignTargetType, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="contacts">Specific Contacts</SelectItem>
                  <SelectItem value="group">Contact Group</SelectItem>
                  <SelectItem value="tags">Contact Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === 'all' ? (
              <div className="space-y-2">
                <Label>Exclude Contacts</Label>
                <CampaignOptionPicker
                  mode="multiple"
                  title="Exclude contacts"
                  description="Choose contacts that should be skipped when this campaign targets all contacts."
                  placeholder="Select contacts to exclude"
                  searchPlaceholder="Search contacts by name, email, or phone"
                  emptyMessage="No contacts matched your search."
                  options={contactOptions}
                  selectedOptions={toOptionArray(excludedContacts)}
                  search={contactSearch}
                  page={contactPage}
                  totalPages={contactsMeta?.totalPages ?? 0}
                  totalCount={contactsMeta?.total}
                  isLoading={contactsQuery.isLoading}
                  onSearchChange={setContactSearch}
                  onPageChange={setContactPage}
                  onSelect={(option) => setExcludedContacts((current) => toggleOptionMap(current, option))}
                  onRemove={(option) => setExcludedContacts((current) => removeOptionFromMap(current, option.value))}
                  onClear={() => setExcludedContacts(clearOptionMap())}
                />
                <p className="text-xs text-muted-foreground">
                  Selected contacts will be excluded from the full contact audience before the campaign is sent.
                </p>
              </div>
            ) : null}

            {targetType === 'contacts' ? (
              <div className="space-y-2">
                <Label required>Include Contacts</Label>
                <CampaignOptionPicker
                  mode="multiple"
                  title="Select contacts"
                  description="Search your contacts and include only the people who should receive this campaign."
                  placeholder="Select contacts to include"
                  searchPlaceholder="Search contacts by name, email, or phone"
                  emptyMessage="No contacts matched your search."
                  options={contactOptions}
                  selectedOptions={toOptionArray(selectedContacts)}
                  search={contactSearch}
                  page={contactPage}
                  totalPages={contactsMeta?.totalPages ?? 0}
                  totalCount={contactsMeta?.total}
                  isLoading={contactsQuery.isLoading}
                  onSearchChange={setContactSearch}
                  onPageChange={setContactPage}
                  onSelect={(option) => setSelectedContacts((current) => toggleOptionMap(current, option))}
                  onRemove={(option) => setSelectedContacts((current) => removeOptionFromMap(current, option.value))}
                  onClear={() => setSelectedContacts(clearOptionMap())}
                />
              </div>
            ) : null}

            {targetType === 'group' ? (
              <div className="space-y-2">
                <Label required>Select Group</Label>
                <CampaignOptionPicker
                  mode="multiple"
                  title="Select contact groups"
                  description="Choose one or more groups. The campaign will target the combined contacts from those groups."
                  placeholder="Select groups"
                  searchPlaceholder="Search groups"
                  emptyMessage="No groups matched your search."
                  options={groupOptions}
                  selectedOptions={toOptionArray(selectedGroups)}
                  search={groupSearch}
                  page={groupPage}
                  totalPages={groupsMeta?.totalPages ?? 0}
                  totalCount={groupsMeta?.total}
                  isLoading={groupsQuery.isLoading}
                  onSearchChange={setGroupSearch}
                  onPageChange={setGroupPage}
                  onSelect={(option) => setSelectedGroups((current) => toggleOptionMap(current, option))}
                  onRemove={(option) => setSelectedGroups((current) => removeOptionFromMap(current, option.value))}
                  onClear={() => setSelectedGroups(clearOptionMap())}
                />
              </div>
            ) : null}

            {targetType === 'tags' ? (
              <div className="space-y-2">
                <Label required>Select Tags</Label>
                <CampaignOptionPicker
                  mode="multiple"
                  title="Select contact tags"
                  description="Choose one or more tags. The campaign will target contacts that match those tags."
                  placeholder="Select tags"
                  searchPlaceholder="Search tags"
                  emptyMessage="No tags matched your search."
                  options={tagOptions}
                  selectedOptions={toOptionArray(selectedTags)}
                  search={tagSearch}
                  page={tagPage}
                  totalPages={tagsMeta?.totalPages ?? 0}
                  totalCount={tagsMeta?.total}
                  isLoading={tagsQuery.isLoading}
                  onSearchChange={setTagSearch}
                  onPageChange={setTagPage}
                  onSelect={(option) => setSelectedTags((current) => toggleOptionMap(current, option))}
                  onRemove={(option) => setSelectedTags((current) => removeOptionFromMap(current, option.value))}
                  onClear={() => setSelectedTags(clearOptionMap())}
                />
              </div>
            ) : null}

            {audienceErrorMessage || errors.target_config?.contact_ids || errors.target_config?.group_ids || errors.target_config?.tag_ids ? (
              <p className="text-sm text-destructive">
                {audienceErrorMessage
                  || errors.target_config?.contact_ids?.message
                  || errors.target_config?.group_ids?.message
                  || errors.target_config?.tag_ids?.message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {selectedTemplate && variableFields.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Variables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This template uses variables. Set each one to a static value or choose a dynamic contact field so every message is personalized safely.
              </p>

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
                              updateVariableBinding(field.key, { mode: 'static', value: '' });
                            }

                            if (value === 'dynamic') {
                              updateVariableBinding(field.key, { mode: 'dynamic', source: 'full_name' });
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
                              updateVariableBinding(field.key, {
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
                              updateVariableBinding(field.key, {
                                mode: 'static',
                                value: event.target.value,
                              })
                            }
                            placeholder="Enter the exact value to send"
                          />
                        ) : (
                          <div className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
                            Choose how this variable should be populated before creating the campaign.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!variableBindingsComplete ? (
                <p className="text-sm text-destructive">
                  Complete every variable binding before creating the campaign.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/campaigns')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitDisabled}>
            {createCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Campaign
          </Button>
        </div>
      </form>
    </div>
  );
}
