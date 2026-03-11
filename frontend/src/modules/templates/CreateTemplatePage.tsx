import { useMemo, useState } from 'react';
import { useNavigate, useParams, type NavigateFunction } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { Subscription, Template, WaAccount } from '@/core/types';
import { useFlows } from '@/modules/flows/useFlows';
import { useCurrentSubscription } from '@/modules/subscription/useSubscriptions';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { findWhatsAppAccount } from '@/modules/whatsapp/accountOptions';
import { buildTemplatePayload, createEmptyTemplateDraft, hydrateTemplateDraft, type TemplateDraft } from './templateBuilder';
import {
  FieldError,
  TypeCard,
  ValidationSummary,
} from './TemplateComposerHelpers';
import {
  AuthenticationTemplateSection,
  CarouselTemplateSection,
  FlowTemplateSection,
  ListMenuTemplateSection,
  StandardTemplateSection,
} from './TemplateFormSections';
import { TemplateOptionSelect } from './TemplateOptionSelect';
import { WhatsAppTemplatePreview } from './WhatsAppTemplatePreview';
import {
  META_TEMPLATE_LANGUAGES,
  TEMPLATE_CATEGORY_OPTIONS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
  getTemplateLanguageLabel,
} from './templateCatalog';
import { findIssue, type ValidationIssue } from './templateComposerUtils';
import { createTemplateSchema, type CreateTemplateFormData } from './validations';
import { useCreateTemplate, useTemplate, useUpdateTemplate } from './useTemplates';
import { buildTemplateWabaOptions, findTemplateWabaOption } from './wabaOptions';

function getValidationIssues(payload: CreateTemplateFormData): ValidationIssue[] {
  const result = createTemplateSchema.safeParse(payload);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

export function CreateTemplatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const { data: existing, isLoading: isTemplateLoading } = useTemplate(id);
  const { data: waAccounts } = useWhatsAppAccounts();
  const { data: currentSubscription } = useCurrentSubscription();
  const wabaOptions = useMemo(() => buildTemplateWabaOptions(waAccounts), [waAccounts]);

  if (isEdit && isTemplateLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-72" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="h-[920px] w-full rounded-3xl" />
          <Skeleton className="h-[640px] w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (isEdit && !isTemplateLoading && !existing) {
    return <div className="py-12 text-center text-muted-foreground">Template not found.</div>;
  }

  const initialDraft = existing ? hydrateTemplateDraft(existing as Template) : createEmptyTemplateDraft();

  return (
    <TemplateComposer
      key={existing?.id || 'create'}
      draftSeed={initialDraft}
      isEdit={isEdit}
      templateId={id}
      currentSubscription={currentSubscription}
      waAccounts={waAccounts}
      wabaOptions={wabaOptions}
      navigate={navigate}
    />
  );
}

function TemplateComposer({
  draftSeed,
  isEdit,
  templateId,
  currentSubscription,
  waAccounts,
  wabaOptions,
  navigate,
}: {
  draftSeed: TemplateDraft;
  isEdit: boolean;
  templateId?: string;
  currentSubscription: Subscription | null | undefined;
  waAccounts: WaAccount[] | undefined;
  wabaOptions: ReturnType<typeof buildTemplateWabaOptions>;
  navigate: NavigateFunction;
}) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const [draft, setDraft] = useState<TemplateDraft>(draftSeed);
  const assignedAccount = useMemo(
    () => findWhatsAppAccount(waAccounts, draft.wa_account_id),
    [draft.wa_account_id, waAccounts]
  );
  const selectedWabaOption = useMemo(
    () =>
      findTemplateWabaOption(wabaOptions, {
        wabaId: draft.waba_id,
        waAccountId: draft.wa_account_id,
      }),
    [draft.waba_id, draft.wa_account_id, wabaOptions]
  );

  const { data: flowsData } = useFlows({ limit: 100, waba_id: draft.waba_id || undefined });
  const flows = flowsData?.flows || [];

  const payload = useMemo(() => buildTemplatePayload(draft), [draft]);
  const validationIssues = useMemo(() => getValidationIssues(payload), [payload]);
  const isPayloadValid = validationIssues.length === 0;

  const templateLimit = currentSubscription?.plan?.max_templates ?? null;
  const templatesUsed = currentSubscription?.usage?.templates_used ?? 0;
  const templateUsagePercent = templateLimit && templateLimit > 0 ? Math.min(100, (templatesUsed / templateLimit) * 100) : 0;
  const templateLimitReached = !isEdit && templateLimit !== null && templatesUsed >= templateLimit;
  const categoryOptions =
    draft.type === 'authentication'
      ? TEMPLATE_CATEGORY_OPTIONS.filter((option) => option.value === 'AUTHENTICATION')
      : TEMPLATE_CATEGORY_OPTIONS.filter((option) => option.value !== 'AUTHENTICATION');
  const mutationPending = createTemplate.isPending || updateTemplate.isPending;

  const setTemplateType = (nextType: TemplateDraft['type']) => {
    setDraft((current) => ({
      ...current,
      type: nextType,
      category:
        nextType === 'authentication'
          ? 'AUTHENTICATION'
          : current.category === 'AUTHENTICATION'
            ? 'MARKETING'
            : current.category,
    }));
  };

  const handleSubmit = async () => {
    if (templateLimitReached) {
      toast.error('Your plan has reached its template limit. Upgrade the subscription before creating another template.');
      return;
    }
    if (!isPayloadValid) {
      toast.error(validationIssues[0]?.message || 'Template validation failed.');
      return;
    }

    try {
      const result = isEdit && templateId
        ? await updateTemplate.mutateAsync({ id: templateId, ...payload })
        : await createTemplate.mutateAsync(payload);

      toast.success(isEdit ? 'Template updated successfully.' : 'Template created successfully.');
      navigate(`/templates/${result.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to save template.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(isEdit && templateId ? `/templates/${templateId}` : '/templates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {isEdit ? 'Update WhatsApp Template' : 'Create WhatsApp Template'}
              </h1>
              <Badge variant="outline">{TEMPLATE_TYPE_LABELS[draft.type]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Type-specific builder with live preview, Meta language support, and account-selected WABA validation.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(isEdit && templateId ? `/templates/${templateId}` : '/templates')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={mutationPending || templateLimitReached}>
            {mutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Update template' : 'Create template'}
          </Button>
        </div>
      </div>

      <Card className={templateLimitReached ? 'border-destructive/50' : ''}>
        <CardHeader>
          <CardTitle>Subscription guardrail</CardTitle>
          <CardDescription>Template creation is enforced across all WABAs under the active subscription.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium">{currentSubscription?.plan?.name || 'No active plan detected'}</div>
              <div className="text-sm text-muted-foreground">
                {templateLimit !== null ? `${templatesUsed} of ${templateLimit} templates used` : 'Subscription usage data is not available yet.'}
              </div>
            </div>
            {templateLimit !== null ? (
              <Badge variant={templateLimitReached ? 'destructive' : 'secondary'}>
                {templateLimitReached ? 'Limit reached' : 'Within limit'}
              </Badge>
            ) : null}
          </div>
          {templateLimit !== null ? <Progress value={templateUsagePercent} /> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
              <CardDescription>Set the template identity, connected WABA, language, and Meta category.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Template name</Label>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="order_confirmation" />
                  <FieldError message={findIssue(validationIssues, 'name')} />
                </div>
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input value={draft.display_name} onChange={(event) => setDraft((current) => ({ ...current, display_name: event.target.value }))} placeholder="Order confirmation" />
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <TemplateOptionSelect
                    value={draft.language}
                    options={META_TEMPLATE_LANGUAGES.map((language) => ({ value: language.value, label: language.label }))}
                    placeholder="Select Meta-supported language"
                    searchPlaceholder="Search supported WhatsApp template languages"
                    emptyMessage="No language matches your search."
                    onChange={(value) => setDraft((current) => ({ ...current, language: value }))}
                  />
                  <FieldError message={findIssue(validationIssues, 'language')} />
                </div>
                <div className="space-y-2">
                  <Label>WABA</Label>
                  <TemplateOptionSelect
                    value={selectedWabaOption?.value || null}
                    options={wabaOptions}
                    placeholder="Select a connected WABA"
                    searchPlaceholder="Search connected WABAs"
                    emptyMessage="No active WhatsApp WABAs found."
                    onChange={(value) => {
                      const option = findTemplateWabaOption(wabaOptions, { wabaId: value });
                      setDraft((current) => ({
                        ...current,
                        wa_account_id: option?.wa_account_id || '',
                        waba_id: option?.waba_id || '',
                        flow: {
                          ...current.flow,
                          flow_id: '',
                          flow_name: '',
                          navigate_screen: '',
                        },
                      }));
                    }}
                    disabled={wabaOptions.length === 0}
                  />
                  <FieldError message={findIssue(validationIssues, 'wa_account_id')} />
                  {selectedWabaOption ? (
                    <p className="text-xs text-muted-foreground">
                      WABA {selectedWabaOption.waba_id} selected. Template actions stay WABA-scoped.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Choose a connected WABA. Nyife will map it to an active account behind the scenes.
                    </p>
                  )}
                  {assignedAccount && assignedAccount.status !== 'active' ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This template is currently linked to an inactive account. Reassign it to an active WABA option before publishing or syncing.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={draft.category} onValueChange={(value) => setDraft((current) => ({ ...current, category: value as TemplateDraft['category'] }))} disabled={draft.type === 'authentication'}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={findIssue(validationIssues, 'category')} />
                </div>
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Templates are counted per user, not per WABA selection. Choosing a different connected WABA will not bypass subscription limits.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Template type</CardTitle>
              <CardDescription>Switching the type changes the builder so only required fields stay visible.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {TEMPLATE_TYPE_OPTIONS.map((option) => (
                <TypeCard key={option.value} title={option.label} description={option.description} active={draft.type === option.value} onClick={() => setTemplateType(option.value as TemplateDraft['type'])} />
              ))}
            </CardContent>
          </Card>

          {draft.type === 'standard' ? <StandardTemplateSection draft={draft} onChange={setDraft} /> : null}
          {draft.type === 'authentication' ? <AuthenticationTemplateSection draft={draft} onChange={setDraft} /> : null}
          {draft.type === 'flow' ? <FlowTemplateSection draft={draft} flows={flows} onChange={setDraft} /> : null}
          {draft.type === 'list_menu' ? <ListMenuTemplateSection draft={draft} onChange={setDraft} /> : null}
          {draft.type === 'carousel' ? <CarouselTemplateSection draft={draft} onChange={setDraft} /> : null}
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <WhatsAppTemplatePreview
            templateName={draft.display_name || draft.name || 'Untitled template'}
            type={draft.type}
            components={payload.components}
            draft={draft}
          />
          <Card>
            <CardHeader>
              <CardTitle>Validation checklist</CardTitle>
              <CardDescription>One concise summary of the Meta-facing client-side checks before save or publish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ValidationSummary valid={isPayloadValid} issueCount={validationIssues.length} />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Language: {getTemplateLanguageLabel(draft.language)}</p>
                <p>Selected WABA: {selectedWabaOption?.waba_id || 'No WABA selected yet'}</p>
                <p>WABA: {draft.waba_id || 'No WABA selected yet'}</p>
                <p>Category: {draft.category}</p>
                <p>Type: {TEMPLATE_TYPE_LABELS[draft.type]}</p>
              </div>
              {isPayloadValid ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  All current client-side template checks passed, including type-specific rules and Meta media/file guards.
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <div className="mb-2 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Fix these items
                  </div>
                  <div className="space-y-1">
                    {validationIssues.slice(0, 8).map((issue) => (
                      <p key={`${issue.path}-${issue.message}`}>{issue.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
