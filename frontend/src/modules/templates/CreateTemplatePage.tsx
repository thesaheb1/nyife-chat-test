import { useMemo, useState } from 'react';
import { useNavigate, useParams, type NavigateFunction } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import type { Subscription, Template, WaAccount } from '@/core/types';
import { useFlows } from '@/modules/flows/useFlows';
import { useCurrentSubscription } from '@/modules/subscription/useSubscriptions';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { getActiveWhatsAppAccounts, resolveWhatsAppPreviewAccount } from '@/modules/whatsapp/accountOptions';
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
import { TemplateStatusBadges } from './TemplateStatusBadges';
import { WhatsAppTemplatePreview } from './WhatsAppTemplatePreview';
import {
  META_TEMPLATE_LANGUAGES,
  TEMPLATE_CATEGORY_OPTIONS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
  getTemplateLanguageLabel,
  resolveTemplateMetaStatus,
} from './templateCatalog';
import { findIssue, type ValidationIssue } from './templateComposerUtils';
import { runTemplateActionToast } from './templateToast';
import { createTemplateSchema, type CreateTemplateFormData } from './validations';
import { useCreateTemplate, useTemplate, useUpdateTemplate } from './useTemplates';

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

  if (isEdit && isTemplateLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-72" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-230 w-full rounded-3xl" />
          <Skeleton className="h-160 w-full rounded-3xl" />
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
      existingTemplate={existing}
      currentSubscription={currentSubscription}
      waAccounts={waAccounts}
      navigate={navigate}
    />
  );
}

function TemplateComposer({
  draftSeed,
  isEdit,
  templateId,
  existingTemplate,
  currentSubscription,
  waAccounts,
  navigate,
}: {
  draftSeed: TemplateDraft;
  isEdit: boolean;
  templateId?: string;
  existingTemplate?: Template;
  currentSubscription: Subscription | null | undefined;
  waAccounts: WaAccount[] | undefined;
  navigate: NavigateFunction;
}) {
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const [draft, setDraft] = useState<TemplateDraft>(draftSeed);
  const activeAccounts = useMemo(() => getActiveWhatsAppAccounts(waAccounts), [waAccounts]);
  const { data: flowsData } = useFlows({ limit: 100 });
  const flows = flowsData?.flows || [];

  const payload = useMemo(() => buildTemplatePayload(draft), [draft]);
  const validationIssues = useMemo(() => getValidationIssues(payload), [payload]);
  const isPayloadValid = validationIssues.length === 0;

  const templateLimit = currentSubscription?.plan?.max_templates ?? null;
  const templatesUsed = currentSubscription?.usage?.templates_used ?? 0;
  const templateUsagePercent = templateLimit && templateLimit > 0 ? Math.min(100, (templatesUsed / templateLimit) * 100) : 0;
  const templateLimitReached = !isEdit && templateLimit !== null && templatesUsed >= templateLimit;
  const effectiveMetaStatus = resolveTemplateMetaStatus(existingTemplate);
  const isMetaEditableTemplate = Boolean(
    existingTemplate?.meta_template_id
    && ['APPROVED', 'REJECTED', 'PAUSED'].includes(effectiveMetaStatus || '')
  );
  const approvedMetaTemplate = effectiveMetaStatus === 'APPROVED';
  const categoryLocked = draft.type === 'authentication' || approvedMetaTemplate;
  const submitLabel = isEdit
    ? isMetaEditableTemplate
      ? 'Save to Meta'
      : 'Update template'
    : 'Create template';
  const categoryOptions =
    draft.type === 'authentication'
      ? TEMPLATE_CATEGORY_OPTIONS.filter((option) => option.value === 'AUTHENTICATION')
      : TEMPLATE_CATEGORY_OPTIONS.filter((option) => option.value !== 'AUTHENTICATION');
  const mutationPending = createTemplate.isPending || updateTemplate.isPending;
  const previewAccount = useMemo(
    () => resolveWhatsAppPreviewAccount(waAccounts, {
      waAccountId: draft.wa_account_id || existingTemplate?.wa_account_id,
      wabaId: draft.waba_id || existingTemplate?.waba_id,
    }),
    [
      draft.wa_account_id,
      draft.waba_id,
      existingTemplate?.wa_account_id,
      existingTemplate?.waba_id,
      waAccounts,
    ]
  );

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
    if (!isEdit && activeAccounts.length === 0) {
      toast.error('Connect an active WhatsApp number before creating a template.');
      return;
    }
    if (!isPayloadValid) {
      toast.error(validationIssues[0]?.message || 'Template validation failed.');
      return;
    }

    try {
      await runTemplateActionToast(
        isEdit && templateId
          ? updateTemplate.mutateAsync({ id: templateId, ...payload })
          : createTemplate.mutateAsync(payload),
        {
          loading: isEdit
            ? isMetaEditableTemplate
              ? 'Saving template changes to Meta...'
              : 'Updating template...'
            : 'Creating template...',
          success: isEdit
            ? isMetaEditableTemplate
              ? 'Template updated on Meta and Nyife.'
              : 'Template updated successfully.'
            : 'Template created successfully.',
          error: 'Unable to save template.',
        }
      );
      navigate('/templates');
    } catch {
      return;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {isEdit ? 'Update WhatsApp Template' : 'Create WhatsApp Template'}
              </h1>
              <Badge variant="outline">{TEMPLATE_TYPE_LABELS[draft.type]}</Badge>
              {existingTemplate ? (
                <TemplateStatusBadges
                  template={existingTemplate}
                  showMetaStatus={Boolean(effectiveMetaStatus)}
                />
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Type-specific builder with live preview, Meta language support, and automatic organization-level routing.
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => navigate('/templates')}>
            Cancel
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={mutationPending || templateLimitReached}>
            {mutationPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </div>
      </div>

      <div
        className={[
          'rounded-2xl border bg-muted/20 px-3.5 py-3',
          templateLimitReached ? 'border-destructive/40 bg-destructive/5' : 'border-border/60',
        ].join(' ')}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Subscription</span>
              <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px]">
                {currentSubscription?.plan?.name || 'No active plan'}
              </Badge>
              {templateLimit !== null ? (
                <Badge variant={templateLimitReached ? 'destructive' : 'secondary'} className="h-6 rounded-full px-2.5 text-[11px]">
                  {templateLimitReached ? 'Limit reached' : 'Within limit'}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {templateLimit !== null
                ? `${templatesUsed} of ${templateLimit} templates used across this organization.`
                : 'Subscription usage data is not available yet.'}
            </p>
          </div>
          {templateLimit !== null ? (
            <div className="w-full lg:max-w-[14rem]">
              <Progress value={templateUsagePercent} className="h-1.5" />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_356px] 2xl:grid-cols-[minmax(0,1fr)_372px]">
        <div className="space-y-6">
          {isMetaEditableTemplate ? (
            <Card className="border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30">
              <CardHeader>
                <CardTitle>Meta edit mode</CardTitle>
                <CardDescription>
                  This template already exists on Meta, so save will update the live Meta template and then refresh the local record.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-sky-950 dark:text-sky-100">
                <p>
                  Template name, language, and type stay locked after Meta creates the template.
                </p>
                <p>
                  {approvedMetaTemplate
                    ? 'Meta-approved templates also keep their category locked.'
                    : 'Category remains editable until Meta approves the template again.'}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Basic information</CardTitle>
              <CardDescription>Set the template identity, language, and Meta category.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>Template name</Label>
                  <Input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="order_confirmation"
                    disabled={isMetaEditableTemplate}
                  />
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
                    disabled={isMetaEditableTemplate}
                  />
                  <FieldError message={findIssue(validationIssues, 'language')} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(value) => setDraft((current) => ({ ...current, category: value as TemplateDraft['category'] }))}
                    disabled={categoryLocked}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={findIssue(validationIssues, 'category')} />
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
                <TypeCard
                  key={option.value}
                  title={option.label}
                  description={option.description}
                  active={draft.type === option.value}
                  disabled={isMetaEditableTemplate}
                  onClick={() => setTemplateType(option.value as TemplateDraft['type'])}
                />
              ))}
            </CardContent>
          </Card>

          {draft.type === 'standard' ? <StandardTemplateSection draft={draft} onChange={setDraft} /> : null}
          {draft.type === 'authentication' ? <AuthenticationTemplateSection draft={draft} onChange={setDraft} /> : null}
          {draft.type === 'flow' ? <FlowTemplateSection draft={draft} flows={flows} onChange={setDraft} /> : null}
          {draft.type === 'list_menu' ? <ListMenuTemplateSection draft={draft} onChange={setDraft} /> : null}
          {draft.type === 'carousel' ? <CarouselTemplateSection draft={draft} onChange={setDraft} /> : null}
        </div>

        <div className="space-y-5 xl:self-start">
          <div className="xl:sticky xl:top-20 xl:z-10">
            <WhatsAppTemplatePreview
              templateName={draft.display_name || draft.name || 'Untitled template'}
              type={draft.type}
              components={payload.components}
              draft={draft}
              accountName={previewAccount?.verified_name || previewAccount?.display_phone || null}
              accountPhone={previewAccount?.display_phone}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Validation checklist</CardTitle>
              <CardDescription>One concise summary of the Meta-facing client-side checks before save or publish.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ValidationSummary valid={isPayloadValid} issueCount={validationIssues.length} />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Language: {getTemplateLanguageLabel(draft.language)}</p>
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
