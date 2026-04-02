import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
} from './useCampaigns';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { createCampaignSchema } from './validations';
import type { CreateCampaignFormData } from './validations';
import { CampaignOptionPicker, type CampaignPickerOption } from './CampaignOptionPicker';
import { CampaignTemplateInputsSection } from './CampaignTemplateInputsSection';
import {
  areCampaignLocationBindingsComplete,
  areCampaignMediaBindingsComplete,
  areCampaignProductBindingsComplete,
  areCampaignVariableBindingsComplete,
  extractCampaignTemplateLocationFields,
  extractCampaignTemplateMediaFields,
  extractCampaignTemplateProductFields,
  extractCampaignTemplateVariables,
  pruneCampaignLocationBindings,
  pruneCampaignMediaBindings,
  pruneCampaignProductBindings,
  pruneCampaignVariableBindings,
  type CampaignLocationField,
  type CampaignMediaField,
  type CampaignProductField,
  type CampaignVariableBinding,
  type CampaignVariableField,
  type CampaignVariableSource,
  templateRequiresCatalogSupport,
} from './campaignTemplateVariables';
import { useTemplate, useTemplates } from '@/modules/templates/useTemplates';
import {
  buildActivePhoneNumberOptions,
  findWhatsAppAccount,
  getWhatsAppPhoneNumberLabel,
} from '@/modules/whatsapp/accountOptions';
import { useWhatsAppAccountHealth, useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { useContacts, useGroups, useTags } from '@/modules/contacts/useContacts';
import { hasFilledValue, useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';
import type {
  CampaignLocationBinding,
  CampaignMediaBinding,
  CampaignProductBinding,
  CampaignTemplateBindings,
  Contact,
  Group,
  Tag,
  Template,
} from '@/core/types';

type CampaignTargetType = CreateCampaignFormData['target_type'];
type OptionMap = Record<string, CampaignPickerOption>;

const PAGE_SIZE = 12;
const EMPTY_TEMPLATES: Template[] = [];

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

function isRecordEmpty(map: Record<string, unknown>) {
  return Object.keys(map).length === 0;
}

function toOptionArray(map: OptionMap) {
  return Object.values(map);
}

function buildFallbackOption(id: string, noun: string): CampaignPickerOption {
  return {
    value: id,
    label: id,
    description: `${noun} selected in this draft campaign`,
  };
}

function buildOptionMapFromIds(ids: string[] | undefined, noun: string) {
  return Object.fromEntries(
    (ids || []).map((id) => [id, buildFallbackOption(id, noun)])
  );
}

function mergeOptionsIntoMap(current: OptionMap, options: CampaignPickerOption[]) {
  let hasChanges = false;
  const next = { ...current };

  options.forEach((option) => {
    const existing = next[option.value];
    const needsUpdate =
      !existing
      || existing.label !== option.label
      || existing.description !== option.description
      || existing.meta !== option.meta
      || existing.badge !== option.badge;

    if (needsUpdate) {
      next[option.value] = option;
      hasChanges = true;
    }
  });

  return hasChanges ? next : current;
}

function areVariableBindingsEqual(
  current: Record<string, CampaignVariableBinding>,
  next: Record<string, CampaignVariableBinding>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => {
    const currentBinding = current[key];
    const nextBinding = next[key];

    if (!currentBinding || !nextBinding || currentBinding.mode !== nextBinding.mode) {
      return false;
    }

    if (currentBinding.mode === 'static' && nextBinding.mode === 'static') {
      return currentBinding.value === nextBinding.value;
    }

    if (currentBinding.mode === 'dynamic' && nextBinding.mode === 'dynamic') {
      return currentBinding.source === nextBinding.source;
    }

    return false;
  });
}

function areMediaBindingsEqual(
  current: Record<string, CampaignMediaBinding>,
  next: Record<string, CampaignMediaBinding>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => {
    const currentBinding = current[key];
    const nextBinding = next[key];

    if (!currentBinding || !nextBinding) {
      return false;
    }

    return (
      currentBinding.file_id === nextBinding.file_id
      && currentBinding.media_type === nextBinding.media_type
      && currentBinding.original_name === nextBinding.original_name
      && currentBinding.mime_type === nextBinding.mime_type
      && currentBinding.size === nextBinding.size
      && currentBinding.preview_url === nextBinding.preview_url
    );
  });
}

function areLocationBindingsEqual(
  current: Record<string, CampaignLocationBinding>,
  next: Record<string, CampaignLocationBinding>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => {
    const currentBinding = current[key];
    const nextBinding = next[key];

    if (!currentBinding || !nextBinding) {
      return false;
    }

    return (
      currentBinding.latitude === nextBinding.latitude
      && currentBinding.longitude === nextBinding.longitude
      && currentBinding.name === nextBinding.name
      && currentBinding.address === nextBinding.address
    );
  });
}

function areProductBindingsEqual(
  current: Record<string, CampaignProductBinding>,
  next: Record<string, CampaignProductBinding>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => {
    const currentBinding = current[key];
    const nextBinding = next[key];

    if (!currentBinding || !nextBinding) {
      return false;
    }

    return currentBinding.product_retailer_id === nextBinding.product_retailer_id;
  });
}

function normalizeVariableBindingsForForm(
  bindings:
    | CampaignTemplateBindings['variables']
    | Record<string, CampaignVariableBinding>
    | null
    | undefined
) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  const normalized: Record<string, CampaignVariableBinding> = {};

  Object.entries(bindings).forEach(([key, value]) => {
    if (typeof value === 'string') {
      normalized[key] = { mode: 'static', value };
      return;
    }

    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && value.mode === 'static'
      && typeof value.value === 'string'
    ) {
      normalized[key] = { mode: 'static', value: value.value };
      return;
    }

    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && value.mode === 'dynamic'
      && ['full_name', 'email', 'phone'].includes(String(value.source || ''))
    ) {
      normalized[key] = {
        mode: 'dynamic',
        source: value.source as CampaignVariableSource,
      };
    }
  });

  return normalized;
}

function normalizeMediaBindingsForForm(bindings: CampaignTemplateBindings['media'] | null | undefined) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
  ) as Record<string, CampaignMediaBinding>;
}

function normalizeLocationBindingsForForm(bindings: CampaignTemplateBindings['locations'] | null | undefined) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).flatMap(([key, value]) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }

      const latitude = typeof value.latitude === 'number' && Number.isFinite(value.latitude)
        ? value.latitude
        : undefined;
      const longitude = typeof value.longitude === 'number' && Number.isFinite(value.longitude)
        ? value.longitude
        : undefined;
      const name = typeof value.name === 'string' ? value.name : undefined;
      const address = typeof value.address === 'string' ? value.address : undefined;

      return [[key, {
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
      }]];
    })
  ) as Record<string, CampaignLocationBinding>;
}

function normalizeProductBindingsForForm(bindings: CampaignTemplateBindings['products'] | null | undefined) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(bindings).flatMap(([key, value]) => {
      if (
        !value
        || typeof value !== 'object'
        || Array.isArray(value)
        || typeof value.product_retailer_id !== 'string'
        || value.product_retailer_id.trim().length === 0
      ) {
        return [];
      }

      return [[key, { product_retailer_id: value.product_retailer_id.trim() }]];
    })
  ) as Record<string, CampaignProductBinding>;
}

function buildTemplateBindingsPayload(
  variableBindings: Record<string, CampaignVariableBinding>,
  mediaBindings: Record<string, CampaignMediaBinding>,
  locationBindings: Record<string, CampaignLocationBinding>,
  productBindings: Record<string, CampaignProductBinding>
) {
  const variables = Object.keys(variableBindings).length > 0 ? variableBindings : undefined;
  const media = Object.keys(mediaBindings).length > 0 ? mediaBindings : undefined;
  const completeLocationBindings = Object.fromEntries(
    Object.entries(locationBindings).flatMap(([key, binding]) => {
      if (
        typeof binding.latitude !== 'number'
        || !Number.isFinite(binding.latitude)
        || typeof binding.longitude !== 'number'
        || !Number.isFinite(binding.longitude)
      ) {
        return [];
      }

      return [[key, {
        latitude: binding.latitude,
        longitude: binding.longitude,
        ...(binding.name ? { name: binding.name } : {}),
        ...(binding.address ? { address: binding.address } : {}),
      }]];
    })
  );
  const locations = Object.keys(completeLocationBindings).length > 0 ? completeLocationBindings : undefined;
  const completeProductBindings = Object.fromEntries(
    Object.entries(productBindings).flatMap(([key, binding]) => {
      if (
        typeof binding.product_retailer_id !== 'string'
        || binding.product_retailer_id.trim().length === 0
      ) {
        return [];
      }

      return [[key, {
        product_retailer_id: binding.product_retailer_id.trim(),
      }]];
    })
  );
  const products = Object.keys(completeProductBindings).length > 0 ? completeProductBindings : undefined;

  if (!variables && !media && !locations && !products) {
    return null;
  }

  return {
    ...(variables ? { variables } : {}),
    ...(media ? { media } : {}),
    ...(locations ? { locations } : {}),
    ...(products ? { products } : {}),
  } satisfies CampaignTemplateBindings;
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

function formatDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildTemplateOption(template: Template): CampaignPickerOption {
  const requiresCatalog = templateRequiresCatalogSupport(template);

  return {
    value: template.id,
    label: template.display_name || template.name,
    description: requiresCatalog
      ? `${template.display_name ? template.name : `${template.type} template`} · Requires Meta catalog`
      : template.display_name
        ? template.name
        : `${template.type} template`,
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
  const { id: campaignId } = useParams<{ id: string }>();
  const isEditMode = Boolean(campaignId);
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const editingCampaignQuery = useCampaign(campaignId);
  const editingCampaign = editingCampaignQuery.data;
  const { data: waAccounts } = useWhatsAppAccounts();

  const {
    register,
    handleSubmit,
    reset,
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

  const previousWaAccountIdRef = useRef<string | undefined>(undefined);
  const hydratedCampaignIdRef = useRef<string | null>(null);

  const selectedWaAccount = useMemo(
    () => findWhatsAppAccount(waAccounts, selectedWaAccountId),
    [selectedWaAccountId, waAccounts]
  );
  const selectedWaAccountHealthQuery = useWhatsAppAccountHealth(selectedWaAccountId, Boolean(selectedWaAccountId));
  const activeAccountOptions = useMemo(
    () => buildActivePhoneNumberOptions(waAccounts),
    [waAccounts]
  );
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
  const [mediaBindings, setMediaBindings] = useState<Record<string, CampaignMediaBinding>>({});
  const [locationBindings, setLocationBindings] = useState<Record<string, CampaignLocationBinding>>({});
  const [productBindings, setProductBindings] = useState<Record<string, CampaignProductBinding>>({});

  const {
    data: templatesData,
    isLoading: templatesLoading,
  } = useTemplates({
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
  const selectedTemplateQuery = useTemplate(selectedTemplateId || undefined);

  const editSelectedContactIds = editingCampaign?.target_config?.contact_ids || [];
  const editExcludedContactIds = editingCampaign?.target_config?.exclude_contact_ids || [];
  const editSelectedGroupIds = editingCampaign?.target_config?.group_ids || [];
  const editSelectedTagIds = editingCampaign?.target_config?.tag_ids || [];

  const editContactsQuery = useContacts({
    ids: editSelectedContactIds.join(',') || undefined,
    enabled: isEditMode && editSelectedContactIds.length > 0,
  });
  const editExcludedContactsQuery = useContacts({
    ids: editExcludedContactIds.join(',') || undefined,
    enabled: isEditMode && editExcludedContactIds.length > 0,
  });
  const editGroupsQuery = useGroups({
    ids: editSelectedGroupIds.join(',') || undefined,
    enabled: isEditMode && editSelectedGroupIds.length > 0,
  });
  const editTagsQuery = useTags({
    ids: editSelectedTagIds.join(',') || undefined,
    enabled: isEditMode && editSelectedTagIds.length > 0,
  });

  const templates = templatesData?.data?.templates ?? EMPTY_TEMPLATES;
  const templatesMeta = templatesData?.meta;
  const selectedWaAccountProductCatalogCount =
    selectedWaAccountHealthQuery.data?.health.product_catalogs.count ?? 0;
  const filteredTemplates = useMemo(
    () => templates.filter((template) => {
      if (selectedWaAccountHealthQuery.isLoading) {
        return true;
      }

      if (selectedWaAccountProductCatalogCount > 0) {
        return true;
      }

      return !templateRequiresCatalogSupport(template);
    }),
    [selectedWaAccountHealthQuery.isLoading, selectedWaAccountProductCatalogCount, templates]
  );
  const templateOptions = useMemo(() => filteredTemplates.map(buildTemplateOption), [filteredTemplates]);

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

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) {
      return null;
    }

    return (
      templates.find((template) => template.id === selectedTemplateId)
      || selectedTemplateQuery.data
      || null
    );
  }, [selectedTemplateId, selectedTemplateQuery.data, templates]);

  const variableFields = useMemo<CampaignVariableField[]>(
    () => extractCampaignTemplateVariables(selectedTemplate),
    [selectedTemplate]
  );
  const mediaFields = useMemo<CampaignMediaField[]>(
    () => extractCampaignTemplateMediaFields(selectedTemplate),
    [selectedTemplate]
  );
  const locationFields = useMemo<CampaignLocationField[]>(
    () => extractCampaignTemplateLocationFields(selectedTemplate),
    [selectedTemplate]
  );
  const productFields = useMemo<CampaignProductField[]>(
    () => extractCampaignTemplateProductFields(selectedTemplate),
    [selectedTemplate]
  );
  const variableBindingsComplete = useMemo(
    () => areCampaignVariableBindingsComplete(variableFields, variableBindings),
    [variableBindings, variableFields]
  );
  const mediaBindingsComplete = useMemo(
    () => areCampaignMediaBindingsComplete(mediaFields, mediaBindings),
    [mediaBindings, mediaFields]
  );
  const locationBindingsComplete = useMemo(
    () => areCampaignLocationBindingsComplete(locationFields, locationBindings),
    [locationBindings, locationFields]
  );
  const productBindingsComplete = useMemo(
    () => areCampaignProductBindingsComplete(productFields, productBindings),
    [productBindings, productFields]
  );
  const hasTemplateInputs =
    variableFields.length > 0
    || mediaFields.length > 0
    || locationFields.length > 0
    || productFields.length > 0;
  const templateInputsComplete =
    variableBindingsComplete
    && mediaBindingsComplete
    && locationBindingsComplete
    && productBindingsComplete;
  const selectedTemplatePending = Boolean(selectedTemplateId) && !selectedTemplate;
  const shouldPruneTemplateInputs = !selectedTemplateId || Boolean(selectedTemplate);
  const selectedTemplateRequiresCatalogSupport = templateRequiresCatalogSupport(selectedTemplate);
  const selectedTemplateCatalogBlocked =
    selectedTemplateRequiresCatalogSupport
    && !selectedWaAccountHealthQuery.isLoading
    && selectedWaAccountProductCatalogCount === 0;

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
  }, [selectedContacts, selectedGroups, selectedTags, targetType]);

  const editContactOptions = useMemo(
    () => (editContactsQuery.data?.data.contacts ?? []).map(buildContactOption),
    [editContactsQuery.data?.data.contacts]
  );
  const editExcludedContactOptions = useMemo(
    () => (editExcludedContactsQuery.data?.data.contacts ?? []).map(buildContactOption),
    [editExcludedContactsQuery.data?.data.contacts]
  );
  const editGroupOptions = useMemo(
    () => (editGroupsQuery.data?.data.groups ?? []).map(buildGroupOption),
    [editGroupsQuery.data?.data.groups]
  );
  const editTagOptions = useMemo(
    () => (editTagsQuery.data?.data.tags ?? []).map(buildTagOption),
    [editTagsQuery.data?.data.tags]
  );

  useEffect(() => {
    if (!isEditMode || !editingCampaign || hydratedCampaignIdRef.current === editingCampaign.id) {
      return;
    }

    const storedBindings = editingCampaign.template_bindings || null;

    reset({
      name: editingCampaign.name,
      description: editingCampaign.description || '',
      wa_account_id: editingCampaign.wa_account_id,
      template_id: editingCampaign.template_id,
      type: editingCampaign.type,
      target_type: editingCampaign.target_type,
      target_config: editingCampaign.target_config || {},
      variables_mapping: normalizeVariableBindingsForForm(
        storedBindings?.variables || editingCampaign.variables_mapping
      ),
      template_bindings: storedBindings || undefined,
      scheduled_at: formatDateTimeLocalValue(editingCampaign.scheduled_at),
    });

    setSelectedContacts(buildOptionMapFromIds(editingCampaign.target_config?.contact_ids, 'Contact'));
    setExcludedContacts(buildOptionMapFromIds(editingCampaign.target_config?.exclude_contact_ids, 'Contact'));
    setSelectedGroups(buildOptionMapFromIds(editingCampaign.target_config?.group_ids, 'Group'));
    setSelectedTags(buildOptionMapFromIds(editingCampaign.target_config?.tag_ids, 'Tag'));
    setVariableBindings(
      normalizeVariableBindingsForForm(storedBindings?.variables || editingCampaign.variables_mapping)
    );
    setMediaBindings(normalizeMediaBindingsForForm(storedBindings?.media));
    setLocationBindings(normalizeLocationBindingsForForm(storedBindings?.locations));
    setProductBindings(normalizeProductBindingsForForm(storedBindings?.products));

    setTemplateSearch('');
    setTemplatePage(1);
    setContactSearch('');
    setContactPage(1);
    setGroupSearch('');
    setGroupPage(1);
    setTagSearch('');
    setTagPage(1);

    previousWaAccountIdRef.current = editingCampaign.wa_account_id;
    hydratedCampaignIdRef.current = editingCampaign.id;
  }, [editingCampaign, isEditMode, reset]);

  useEffect(() => {
    if (!editContactOptions.length) {
      return;
    }

    setSelectedContacts((current) => mergeOptionsIntoMap(current, editContactOptions));
  }, [editContactOptions]);

  useEffect(() => {
    if (!editExcludedContactOptions.length) {
      return;
    }

    setExcludedContacts((current) => mergeOptionsIntoMap(current, editExcludedContactOptions));
  }, [editExcludedContactOptions]);

  useEffect(() => {
    if (!editGroupOptions.length) {
      return;
    }

    setSelectedGroups((current) => mergeOptionsIntoMap(current, editGroupOptions));
  }, [editGroupOptions]);

  useEffect(() => {
    if (!editTagOptions.length) {
      return;
    }

    setSelectedTags((current) => mergeOptionsIntoMap(current, editTagOptions));
  }, [editTagOptions]);

  useEffect(() => {
    setValue('target_config', targetConfig, {
      shouldValidate: true,
    });
  }, [setValue, targetConfig]);

  useEffect(() => {
    if (previousWaAccountIdRef.current === undefined) {
      previousWaAccountIdRef.current = selectedWaAccountId;
      return;
    }

    if (previousWaAccountIdRef.current === selectedWaAccountId) {
      return;
    }

    previousWaAccountIdRef.current = selectedWaAccountId;
    setTemplateSearch('');
    setTemplatePage(1);
    setVariableBindings((current) => (isRecordEmpty(current) ? current : {}));
    setMediaBindings((current) => (isRecordEmpty(current) ? current : {}));
    setLocationBindings((current) => (isRecordEmpty(current) ? current : {}));
    setProductBindings((current) => (isRecordEmpty(current) ? current : {}));

    if (selectedTemplateId) {
      setValue('template_id', '', { shouldValidate: true });
    }
  }, [selectedTemplateId, selectedWaAccountId, setValue]);

  useEffect(() => {
    if (!shouldPruneTemplateInputs) {
      return;
    }

    setVariableBindings((current) => {
      const prunedBindings = pruneCampaignVariableBindings(current, variableFields);
      return areVariableBindingsEqual(current, prunedBindings) ? current : prunedBindings;
    });
  }, [shouldPruneTemplateInputs, variableFields]);

  useEffect(() => {
    if (!shouldPruneTemplateInputs) {
      return;
    }

    setMediaBindings((current) => {
      const prunedBindings = pruneCampaignMediaBindings(current, mediaFields);
      return areMediaBindingsEqual(current, prunedBindings) ? current : prunedBindings;
    });
  }, [mediaFields, shouldPruneTemplateInputs]);

  useEffect(() => {
    if (!shouldPruneTemplateInputs) {
      return;
    }

    setLocationBindings((current) => {
      const prunedBindings = pruneCampaignLocationBindings(current, locationFields);
      return areLocationBindingsEqual(current, prunedBindings) ? current : prunedBindings;
    });
  }, [locationFields, shouldPruneTemplateInputs]);

  useEffect(() => {
    if (!shouldPruneTemplateInputs) {
      return;
    }

    setProductBindings((current) => {
      const prunedBindings = pruneCampaignProductBindings(current, productFields);
      return areProductBindingsEqual(current, prunedBindings) ? current : prunedBindings;
    });
  }, [productFields, shouldPruneTemplateInputs]);

  const isMutationPending = createCampaign.isPending || updateCampaign.isPending;
  const isSubmitDisabled =
    isMutationPending
    || !requiredFieldsFilled
    || !audienceSelectionFilled
    || selectedTemplatePending
    || selectedTemplateCatalogBlocked
    || (hasTemplateInputs && !templateInputsComplete)
    || Object.keys(errors).length > 0;

  const templatePickerSelected = useMemo(() => {
    if (selectedTemplate) {
      return [buildTemplateOption(selectedTemplate)];
    }

    if (selectedTemplateId) {
      return [{
        value: selectedTemplateId,
        label: 'Loading template…',
        description: 'Fetching template details for this campaign',
      }];
    }

    return [];
  }, [selectedTemplate, selectedTemplateId]);

  const updateVariableBinding = (key: string, nextBinding: CampaignVariableBinding) => {
    setVariableBindings((current) => {
      const currentBinding = current[key];
      if (
        currentBinding
        && currentBinding.mode === nextBinding.mode
        && (
          (currentBinding.mode === 'static' && nextBinding.mode === 'static' && currentBinding.value === nextBinding.value)
          || (currentBinding.mode === 'dynamic' && nextBinding.mode === 'dynamic' && currentBinding.source === nextBinding.source)
        )
      ) {
        return current;
      }

      return {
        ...current,
        [key]: nextBinding,
      };
    });
  };

  const updateMediaBinding = (key: string, nextBinding: CampaignMediaBinding | null) => {
    setMediaBindings((current) => {
      if (!nextBinding) {
        if (!current[key]) {
          return current;
        }

        const next = { ...current };
        delete next[key];
        return next;
      }

      const currentBinding = current[key];
      if (
        currentBinding
        && currentBinding.file_id === nextBinding.file_id
        && currentBinding.media_type === nextBinding.media_type
        && currentBinding.original_name === nextBinding.original_name
        && currentBinding.mime_type === nextBinding.mime_type
        && currentBinding.size === nextBinding.size
        && currentBinding.preview_url === nextBinding.preview_url
      ) {
        return current;
      }

      return {
        ...current,
        [key]: nextBinding,
      };
    });
  };

  const updateLocationBinding = (key: string, nextBinding: CampaignLocationBinding | null) => {
    setLocationBindings((current) => {
      if (!nextBinding) {
        if (!current[key]) {
          return current;
        }

        const next = { ...current };
        delete next[key];
        return next;
      }

      const currentBinding = current[key];
      if (
        currentBinding
        && currentBinding.latitude === nextBinding.latitude
        && currentBinding.longitude === nextBinding.longitude
        && currentBinding.name === nextBinding.name
        && currentBinding.address === nextBinding.address
      ) {
        return current;
      }

      return {
        ...current,
        [key]: nextBinding,
      };
    });
  };

  const updateProductBinding = (key: string, nextBinding: CampaignProductBinding | null) => {
    setProductBindings((current) => {
      if (!nextBinding) {
        if (!current[key]) {
          return current;
        }

        const next = { ...current };
        delete next[key];
        return next;
      }

      const currentBinding = current[key];
      if (
        currentBinding
        && currentBinding.product_retailer_id === nextBinding.product_retailer_id
      ) {
        return current;
      }

      return {
        ...current,
        [key]: nextBinding,
      };
    });
  };

  const onSubmit = async (data: CreateCampaignFormData) => {
    const templateBindings = buildTemplateBindingsPayload(
      variableBindings,
      mediaBindings,
      locationBindings,
      productBindings
    );
    const payload: CreateCampaignFormData = {
      ...data,
      target_config: targetConfig,
      variables_mapping: variableBindings,
      template_bindings: templateBindings || undefined,
    };

    try {
      if (isEditMode && campaignId) {
        const updatedCampaign = await updateCampaign.mutateAsync({
          id: campaignId,
          ...payload,
          template_bindings: templateBindings,
        });
        toast.success('Draft campaign updated successfully');
        navigate(`/campaigns/${updatedCampaign.id}`);
        return;
      }

      await createCampaign.mutateAsync(payload);
      toast.success('Campaign created successfully');
      navigate('/campaigns');
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          isEditMode ? 'Failed to update draft campaign.' : 'Failed to create campaign.'
        )
      );
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

  const backPath = isEditMode && campaignId ? `/campaigns/${campaignId}` : '/campaigns';
  const pageTitle = isEditMode ? 'Edit Draft Campaign' : 'Create Campaign';
  const pageDescription = isEditMode
    ? 'Update this draft campaign before scheduling or starting it.'
    : 'Create a campaign with the right audience, template inputs, and schedule.';

  if (isEditMode && editingCampaignQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">Loading draft campaign details…</p>
          </div>
        </div>

        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing the draft campaign form.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditMode && !editingCampaignQuery.isLoading && !editingCampaign) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Draft Campaign Not Found</h1>
        </div>

        <Card>
          <CardContent className="space-y-4 py-8">
            <p className="text-sm text-muted-foreground">
              This draft campaign could not be loaded. It may have been deleted or moved.
            </p>
            <Button type="button" onClick={() => navigate('/campaigns')}>
              Back to Campaigns
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditMode && editingCampaign && editingCampaign.status !== 'draft') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/campaigns/${editingCampaign.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Only Draft Campaigns Can Be Edited</h1>
        </div>

        <Card>
          <CardContent className="space-y-4 py-8">
            <p className="text-sm text-muted-foreground">
              This campaign is currently <span className="font-medium capitalize">{editingCampaign.status}</span>.
              Open the campaign detail page to review it or use the available campaign actions there.
            </p>
            <Button type="button" onClick={() => navigate(`/campaigns/${editingCampaign.id}`)}>
              Open Campaign Detail
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageDescription}</p>
        </div>
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
                  onValueChange={(value) =>
                    setValue('wa_account_id', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
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
                    setValue('template_id', option.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setTemplateSearch('');
                    setTemplatePage(1);
                  }}
                  onRemove={() => {
                    setValue('template_id', '', { shouldValidate: true });
                    setVariableBindings({});
                    setMediaBindings({});
                    setLocationBindings({});
                    setProductBindings({});
                  }}
                />
                {errors.template_id ? <p className="text-sm text-destructive">{errors.template_id.message}</p> : null}
                {selectedTemplatePending ? (
                  <p className="text-xs text-muted-foreground">Loading template details and required inputs…</p>
                ) : null}
                {!selectedTemplate && selectedWaAccount && !selectedWaAccountHealthQuery.isLoading && selectedWaAccountProductCatalogCount === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Commerce templates that require a Meta product catalog are hidden for this phone number because no linked catalog was found.
                  </p>
                ) : null}
                {selectedTemplateCatalogBlocked ? (
                  <p className="text-sm text-destructive">
                    This template requires a Meta product catalog linked to the selected WhatsApp account. Link a catalog in Meta or choose another template.
                  </p>
                ) : null}
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

        {selectedTemplate && hasTemplateInputs ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CampaignTemplateInputsSection
                variableFields={variableFields}
                mediaFields={mediaFields}
                locationFields={locationFields}
                productFields={productFields}
                variableBindings={variableBindings}
                mediaBindings={mediaBindings}
                locationBindings={locationBindings}
                productBindings={productBindings}
                onVariableBindingChange={updateVariableBinding}
                onMediaBindingChange={updateMediaBinding}
                onLocationBindingChange={updateLocationBinding}
                onProductBindingChange={updateProductBinding}
                showIncompleteError={isSubmitted && !templateInputsComplete}
              />
            </CardContent>
          </Card>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(backPath)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitDisabled}>
            {isMutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditMode ? 'Save Draft Changes' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}
