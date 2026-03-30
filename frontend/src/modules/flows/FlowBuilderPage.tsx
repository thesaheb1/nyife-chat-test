import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type {
  FlowAvailableAction,
  FlowCategory,
  FlowDefinition,
  MetaFlowDefinition,
  WhatsAppFlow,
} from '@/core/types';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { FlowBuilderHeader } from './FlowBuilderHeader';
import { FlowBuilderWorkspace } from './FlowBuilderWorkspace';
import { FlowJsonEditorCard } from './FlowJsonEditorCard';
import { FlowMetadataPanel } from './FlowMetadataPanel';
import { FlowNoticeCard } from './FlowNoticeCard';
import { FlowPreviewDialog } from './FlowPreviewDialog';
import { getFlowAvailableActions, hasFlowAction } from './flowLifecycle';
import { META_FLOW_MANAGER_URL } from './flowPreview';
import {
  compileMetaFlowDefinition,
  createFlowComponent,
  createFlowDefinition,
  createFlowScreen,
  deriveBuilderStateFromMetaFlow,
  formatValidationDetail,
  moveItem,
  validateFlowDefinition,
} from './flowUtils';
import {
  useCreateFlow,
  useDeleteFlow,
  useDeprecateFlow,
  useDuplicateFlow,
  useFlow,
  usePublishFlow,
  useRefreshFlowPreview,
  useSaveFlowToMeta,
  useUpdateFlow,
} from './useFlows';

type BuilderMode = 'builder' | 'json';
type PreviewTab = 'nyife' | 'meta';
type ConfirmAction = 'publish' | 'delete' | 'deprecate' | null;

interface PreviewDraftState {
  title: string;
  definition: FlowDefinition;
  builderSupported: boolean;
  warning: string | null;
  metaFlowId: string | null;
  previewUrl: string | null;
  previewExpiresAt: string | null;
  syncOfficialPreviewBeforeOpen: boolean;
}

function parseJsonDraft(jsonDraft: string) {
  return JSON.parse(jsonDraft) as MetaFlowDefinition;
}

export function FlowBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const compactWorkspace = useMediaQuery('(max-width: 1279px)');
  const { data: existing, isLoading } = useFlow(id);
  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();
  const deleteFlow = useDeleteFlow();
  const saveToMeta = useSaveFlowToMeta();
  const publishFlow = usePublishFlow();
  const refreshPreview = useRefreshFlowPreview();
  const deprecateFlow = useDeprecateFlow();
  const duplicateFlow = useDuplicateFlow();

  const [initialFlowState] = useState(() => {
    const builder = createFlowDefinition('Lead capture flow', 'LEAD_GENERATION');
    return {
      initialBuilder: builder,
      initialJson: compileMetaFlowDefinition(builder, 'Lead capture flow'),
    };
  });

  const [name, setName] = useState('Lead capture flow');
  const [categories, setCategories] = useState<WhatsAppFlow['categories']>(['LEAD_GENERATION']);
  const [builderDefinition, setBuilderDefinition] = useState<FlowDefinition>(initialFlowState.initialBuilder);
  const [jsonDefinition, setJsonDefinition] = useState<MetaFlowDefinition>(initialFlowState.initialJson);
  const [editorState, setEditorState] = useState<Record<string, unknown>>({});
  const [dataExchangeConfig, setDataExchangeConfig] = useState<Record<string, unknown>>({});
  const [activeScreenId, setActiveScreenId] = useState(initialFlowState.initialBuilder.screens[0]?.id || '');
  const [selectedComponentIndex, setSelectedComponentIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<BuilderMode>('builder');
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(initialFlowState.initialJson, null, 2));
  const [builderSupported, setBuilderSupported] = useState(true);
  const [builderWarning, setBuilderWarning] = useState<string | null>(null);
  const [hasBuilderEdits, setHasBuilderEdits] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewInitialTab, setPreviewInitialTab] = useState<PreviewTab>('nyife');
  const [previewState, setPreviewState] = useState<PreviewDraftState | null>(null);
  const [screensSheetOpen, setScreensSheetOpen] = useState(false);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);

  const primaryCategory = categories[0] || 'OTHER';
  const trimmedName = name.trim();
  const availableActions: FlowAvailableAction[] = isEdit && existing
    ? getFlowAvailableActions(existing)
    : ['view', 'edit', 'publish'];
  const isReadOnly = isEdit && Boolean(existing) && !hasFlowAction(existing, 'edit');

  useEffect(() => {
    if (!existing) {
      return;
    }

    const derived = deriveBuilderStateFromMetaFlow(existing.json_definition);
    // This effect intentionally hydrates the local editing state from the fetched flow.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(existing.name);
    setCategories(existing.categories.length > 0 ? [existing.categories[0]] : ['OTHER']);
    setBuilderDefinition(derived.definition);
    setJsonDefinition(existing.json_definition);
    setEditorState(existing.editor_state || {});
    setDataExchangeConfig(existing.data_exchange_config || {});
    setBuilderSupported(derived.supported);
    setBuilderWarning(derived.warning);
    setMode(derived.supported ? 'builder' : 'json');
    setActiveScreenId(
      String(
        existing.editor_state?.active_screen_id
          || derived.definition.screens[0]?.id
          || ''
      )
    );
    setSelectedComponentIndex(
      typeof existing.editor_state?.selected_component_index === 'number'
        ? Number(existing.editor_state.selected_component_index)
        : null
    );
    setJsonDraft(JSON.stringify(existing.json_definition, null, 2));
    setHasBuilderEdits(true);
    setHasUnsavedChanges(false);
  }, [existing]);

  const activeScreen = useMemo(
    () => builderDefinition.screens.find((screen) => screen.id === activeScreenId) || builderDefinition.screens[0] || null,
    [activeScreenId, builderDefinition.screens]
  );

  const selectedComponent = activeScreen && selectedComponentIndex !== null
    ? activeScreen.layout.children[selectedComponentIndex] || null
    : null;

  const currentBuilderJson = useMemo(
    () => compileMetaFlowDefinition(builderDefinition, trimmedName || 'Flow start'),
    [builderDefinition, trimmedName]
  );

  const localValidationIssues = builderSupported ? validateFlowDefinition(builderDefinition) : [];
  const remoteValidationIssues = (existing?.validation_error_details || [])
    .map((detail) => formatValidationDetail(detail))
    .concat(
      (existing?.validation_errors || []).filter(
        (entry) => !(existing?.validation_error_details || []).some((detail) => formatValidationDetail(detail) === entry)
      )
    );
  const validationIssues = Array.from(new Set([...remoteValidationIssues, ...localValidationIssues]));

  const hasUnsupportedDataExchange = Object.keys(dataExchangeConfig || {}).length > 0;
  const isBusy = createFlow.isPending
    || updateFlow.isPending
    || deleteFlow.isPending
    || saveToMeta.isPending
    || publishFlow.isPending
    || refreshPreview.isPending
    || deprecateFlow.isPending
    || duplicateFlow.isPending;

  const buildCurrentJsonDefinition = () => {
    if (!trimmedName) {
      throw new Error('Flow name is required before continuing.');
    }

    if (mode === 'json') {
      return parseJsonDraft(jsonDraft);
    }

    return currentBuilderJson;
  };

  const buildPreviewState = (): PreviewDraftState => {
    const nextJsonDefinition = buildCurrentJsonDefinition();
    const derived = deriveBuilderStateFromMetaFlow(nextJsonDefinition);

    return {
      title: trimmedName || 'Flow preview',
      definition: derived.definition,
      builderSupported: derived.supported,
      warning: derived.warning,
      metaFlowId: existing?.meta_flow_id || null,
      previewUrl: existing?.preview_url || null,
      previewExpiresAt: existing?.preview_expires_at || null,
      syncOfficialPreviewBeforeOpen: !isReadOnly && (!isEdit || hasUnsavedChanges || !existing?.meta_flow_id),
    };
  };

  const applyParsedJson = (
    parsed: MetaFlowDefinition,
    options: {
      nextMode?: BuilderMode | null;
      successMessage?: string;
      markAsEdited?: boolean;
    } = {}
  ) => {
    const derived = deriveBuilderStateFromMetaFlow(parsed);
    const markAsEdited = options.markAsEdited ?? true;
    setHasBuilderEdits(markAsEdited);
    setHasUnsavedChanges(true);
    setJsonDefinition(parsed);
    setJsonDraft(JSON.stringify(parsed, null, 2));
    setBuilderSupported(derived.supported);
    setBuilderWarning(derived.warning);

    if (derived.supported) {
      setBuilderDefinition(derived.definition);
      setActiveScreenId(derived.definition.screens[0]?.id || '');
      setSelectedComponentIndex(null);
      if (options.nextMode !== null) {
        setMode(options.nextMode || 'builder');
      }
    } else {
      setSelectedComponentIndex(null);
      setMode('json');
    }

    if (options.successMessage) {
      toast.success(options.successMessage);
    }
  };

  const syncBuilderDefinition = (
    nextDefinition: FlowDefinition,
    options: { markAsEdited?: boolean } = {}
  ) => {
    const markAsEdited = options.markAsEdited ?? true;
    setHasBuilderEdits(markAsEdited);
    setHasUnsavedChanges(true);
    setBuilderDefinition(nextDefinition);
    const compiled = compileMetaFlowDefinition(nextDefinition, trimmedName || 'Flow start');
    setJsonDefinition(compiled);
    setJsonDraft(JSON.stringify(compiled, null, 2));
  };

  const applyCategoryStarter = (
    category: FlowCategory,
    options: { keepStarterLinked?: boolean } = {}
  ) => {
    const starterDefinition = createFlowDefinition(trimmedName || 'Flow start', category);
    const compiled = compileMetaFlowDefinition(starterDefinition, trimmedName || 'Flow start');
    const keepStarterLinked = Boolean(options.keepStarterLinked);
    setHasBuilderEdits(!keepStarterLinked);
    setHasUnsavedChanges(true);
    setCategories([category]);
    setBuilderDefinition(starterDefinition);
    setJsonDefinition(compiled);
    setJsonDraft(JSON.stringify(compiled, null, 2));
    setBuilderSupported(true);
    setBuilderWarning(null);
    setMode('builder');
    setActiveScreenId(starterDefinition.screens[0]?.id || '');
    setSelectedComponentIndex(null);
  };

  const updateScreen = (screenId: string, updater: (screen: FlowDefinition['screens'][number]) => FlowDefinition['screens'][number]) => {
    syncBuilderDefinition({
      ...builderDefinition,
      screens: builderDefinition.screens.map((screen) => (screen.id === screenId ? updater(screen) : screen)),
    });
  };

  const updateSelectedComponent = (updater: (component: NonNullable<typeof selectedComponent>) => NonNullable<typeof selectedComponent>) => {
    if (!activeScreen || selectedComponentIndex === null) {
      return;
    }

    updateScreen(activeScreen.id, (screen) => ({
      ...screen,
      layout: {
        ...screen.layout,
        children: screen.layout.children.map((component, index) => (
          index === selectedComponentIndex ? updater(component) : component
        )),
      },
    }));
  };

  const persistFlow = async () => {
    if (isEdit && existing && !hasFlowAction(existing, 'edit')) {
      throw new Error('This flow is read-only in its current lifecycle state. Clone it to create a new editable draft.');
    }

    const nextJsonDefinition = buildCurrentJsonDefinition();
    setJsonDefinition(nextJsonDefinition);
    if (mode === 'json') {
      const derived = deriveBuilderStateFromMetaFlow(nextJsonDefinition);
      setBuilderSupported(derived.supported);
      setBuilderWarning(derived.warning);
      if (derived.supported) {
        setBuilderDefinition(derived.definition);
      }
    }

    const payload = {
      name: trimmedName,
      categories: [primaryCategory],
      json_definition: nextJsonDefinition,
      editor_state: {
        ...editorState,
        active_screen_id: activeScreen?.id || null,
        selected_component_index: selectedComponentIndex,
      },
      data_exchange_config: dataExchangeConfig,
    };

    const flow = isEdit && id
      ? await updateFlow.mutateAsync({ id, ...payload })
      : await createFlow.mutateAsync(payload);

    setHasUnsavedChanges(false);
    return flow;
  };

  const runSaveAction = async (action: 'save' | 'publish') => {
    try {
      const flow = await persistFlow();
      const targetFlowId = flow.id;

      if (!isEdit) {
        navigate(`/flows/${targetFlowId}/edit`, { replace: true });
      }

      if (action === 'save') {
        toast.success('Flow draft saved successfully.');
        return;
      }

      if (hasUnsupportedDataExchange) {
        toast.error('This flow uses data exchange settings that are deferred to phase 2 and cannot be published to Meta yet.');
        return;
      }

      await publishFlow.mutateAsync({ id: targetFlowId });
      setHasUnsavedChanges(false);
      toast.success('Flow published successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Flow action failed.'));
    }
  };

  const applyJsonDraft = () => {
    try {
      const parsed = parseJsonDraft(jsonDraft);
      const derived = deriveBuilderStateFromMetaFlow(parsed);
      applyParsedJson(parsed, {
        nextMode: derived.supported ? 'builder' : 'json',
        successMessage: derived.supported
          ? 'Meta JSON applied to the visual builder.'
          : 'Meta JSON applied. This flow stays in JSON mode because it uses unsupported builder features.',
      });
    } catch {
      toast.error('JSON is not valid.');
    }
  };

  const openPreviewDialog = (tab: PreviewTab = 'nyife') => {
    try {
      setPreviewInitialTab(tab);
      setPreviewState(buildPreviewState());
      setPreviewDialogOpen(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Fix the draft before opening preview.'));
    }
  };

  const closePreviewDialog = (open: boolean) => {
    setPreviewDialogOpen(open);
    if (!open && searchParams.get('preview') === '1') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('preview');
      nextParams.delete('previewTab');
      setSearchParams(nextParams, { replace: true });
    }
  };

  useEffect(() => {
    if (searchParams.get('preview') !== '1' || previewDialogOpen) {
      return;
    }

    if (isEdit && !existing) {
      return;
    }

    openPreviewDialog(searchParams.get('previewTab') === 'meta' ? 'meta' : 'nyife');
    // The builder state itself is the source of truth here; re-opening is driven by the query flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isEdit, previewDialogOpen, searchParams]);

  const prepareOfficialPreview = async () => {
    try {
      if (isReadOnly) {
        if (!id) {
          return null;
        }
        if (!existing?.meta_flow_id) {
          toast.error('Save this flow to Meta before requesting the official preview.');
          return null;
        }
        return await refreshPreview.mutateAsync({
          id,
          force: !existing.preview_url,
        });
      }

      const flow = await persistFlow();
      const syncedFlow = await saveToMeta.mutateAsync({ id: flow.id });
      setHasUnsavedChanges(false);

      if (!isEdit) {
        navigate(`/flows/${flow.id}/edit?preview=1&previewTab=meta`, { replace: true });
      }

      return syncedFlow;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to prepare the official Meta preview.'));
      return null;
    }
  };

  const refreshOfficialPreview = async (force = false) => {
    try {
      if (!id && !existing?.id) {
        return null;
      }

      if (!existing?.meta_flow_id) {
        return await prepareOfficialPreview();
      }

      const targetId = id || existing.id;
      return await refreshPreview.mutateAsync({ id: targetId, force });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to refresh the official Meta preview.'));
      return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span>Loading flow...</span>
      </div>
    );
  }

  const confirmDescription = confirmAction === 'publish'
    ? 'Nyife will save the latest local draft, update the linked Meta draft, refresh validation and health state, and then publish it.'
    : confirmAction === 'deprecate'
      ? 'Deprecation is intended for published, throttled, or blocked flows. The linked Meta flow will no longer stay active for new sends.'
      : 'Draft deletion is permanent in Nyife. If this flow is linked to a Meta draft, Nyife will delete that Meta draft first before removing the local record.';

  return (
    <>
      <div className="space-y-4">
        <FlowBuilderHeader
          isEdit={isEdit}
          flow={existing}
          isBusy={isBusy}
          isReadOnly={isReadOnly}
          publishDisabled={hasUnsupportedDataExchange}
          publishDisabledReason={hasUnsupportedDataExchange ? 'Data exchange flows are deferred for Meta publish in this phase.' : undefined}
          availableActions={availableActions}
          onBack={() => navigate('/flows')}
          onClone={async () => {
            if (!id) {
              return;
            }

            try {
              const flow = await duplicateFlow.mutateAsync(id);
              toast.success('Flow cloned successfully.');
              navigate(`/flows/${flow.id}/edit`);
            } catch (error) {
              toast.error(getApiErrorMessage(error, 'Failed to clone flow.'));
            }
          }}
          onDeprecate={() => setConfirmAction('deprecate')}
          onDelete={() => setConfirmAction('delete')}
          onPublish={() => setConfirmAction('publish')}
          onSaveDraft={() => void runSaveAction('save')}
        />

        <FlowMetadataPanel
          name={name}
          primaryCategory={primaryCategory}
          isBusy={isBusy}
          readOnly={isReadOnly}
          starterLinkedToCategory={!isEdit && !hasBuilderEdits}
          onNameChange={(value) => {
            setName(value);
            setHasUnsavedChanges(true);
          }}
          onCategoryChange={(category) => {
            if (!isEdit && !hasBuilderEdits) {
              applyCategoryStarter(category, { keepStarterLinked: true });
              return;
            }

            setCategories([category]);
            setHasUnsavedChanges(true);
          }}
          onOpenMetaFlowBuilder={() => window.open(META_FLOW_MANAGER_URL, '_blank', 'noopener,noreferrer')}
        />

        {isReadOnly ? (
          <FlowNoticeCard
            title="Read-only lifecycle state"
            tone="info"
            description="This flow is no longer editable in place. Use the allowed lifecycle actions shown in the header instead of changing the saved draft."
          >
            <p>
              Nyife opens published, throttled, blocked, and deprecated flows here for safe review only. Clone creates a new draft. Deprecate remains available only when Meta still treats the flow as active.
            </p>
          </FlowNoticeCard>
        ) : null}

        {builderWarning ? (
          <FlowNoticeCard
            title="Visual builder limited"
            description="Nyife keeps this flow safe in JSON mode because the current Meta definition uses features outside the supported static builder subset."
          >
            <p>{builderWarning}</p>
          </FlowNoticeCard>
        ) : null}

        {hasUnsupportedDataExchange ? (
          <FlowNoticeCard
            title="Data exchange deferred"
            description="Endpoint-powered data exchange stays out of scope for this production hardening round."
          >
            <p>
              Draft save is still allowed, but official Meta preview generation and publish are blocked until this configuration is cleared or phase 2 support is implemented.
            </p>
            <pre className="overflow-auto rounded-2xl bg-amber-100/70 p-3 text-xs text-amber-950">
              {JSON.stringify(dataExchangeConfig, null, 2)}
            </pre>
          </FlowNoticeCard>
        ) : null}

        {validationIssues.length > 0 ? (
          <FlowNoticeCard
            title="Validation issues"
            description="Drafts can still be saved locally, but Meta publish stays blocked until these issues are fixed."
          >
            {validationIssues.map((issue) => <p key={issue}>- {issue}</p>)}
          </FlowNoticeCard>
        ) : null}

        <Tabs value={mode} onValueChange={(value) => setMode(value as BuilderMode)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="builder" disabled={!builderSupported}>Builder</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="builder">
            {builderSupported ? (
              <FlowBuilderWorkspace
                compactLayout={compactWorkspace}
                flowDefinition={builderDefinition}
                activeScreenId={activeScreen?.id || ''}
                activeScreen={activeScreen}
                readOnly={isReadOnly}
                selectedComponent={selectedComponent}
                selectedComponentIndex={selectedComponentIndex}
                screensSheetOpen={screensSheetOpen}
                inspectorSheetOpen={inspectorSheetOpen}
                onScreensSheetOpenChange={setScreensSheetOpen}
                onInspectorSheetOpenChange={setInspectorSheetOpen}
                onSelectScreen={(screenId) => {
                  setActiveScreenId(screenId);
                  setSelectedComponentIndex(null);
                }}
                onAddScreen={() => {
                  const screen = createFlowScreen();
                  syncBuilderDefinition({ ...builderDefinition, screens: [...builderDefinition.screens, screen] });
                  setActiveScreenId(screen.id);
                  setSelectedComponentIndex(null);
                }}
                onMoveScreen={(fromIndex, toIndex) => syncBuilderDefinition({
                  ...builderDefinition,
                  screens: moveItem(builderDefinition.screens, fromIndex, toIndex),
                })}
                onRemoveScreen={(screenId) => {
                  if (builderDefinition.screens.length === 1) {
                    toast.error('At least one screen is required.');
                    return;
                  }
                  const remaining = builderDefinition.screens.filter((screen) => screen.id !== screenId);
                  syncBuilderDefinition({ ...builderDefinition, screens: remaining });
                  setActiveScreenId(remaining[0]?.id || '');
                  setSelectedComponentIndex(null);
                }}
                onAddComponent={(type) => {
                  if (!activeScreen) {
                    return;
                  }

                  updateScreen(activeScreen.id, (screen) => ({
                    ...screen,
                    layout: {
                      ...screen.layout,
                      children: [...screen.layout.children, createFlowComponent(type)],
                    },
                  }));
                  setSelectedComponentIndex(activeScreen.layout.children.length);
                }}
                onSelectComponent={setSelectedComponentIndex}
                onMoveComponent={(fromIndex, toIndex) => {
                  if (!activeScreen || toIndex < 0 || toIndex >= activeScreen.layout.children.length) {
                    return;
                  }

                  updateScreen(activeScreen.id, (screen) => ({
                    ...screen,
                    layout: {
                      ...screen.layout,
                      children: moveItem(screen.layout.children, fromIndex, toIndex),
                    },
                  }));
                  setSelectedComponentIndex(toIndex);
                }}
                onRemoveComponent={(index) => {
                  if (!activeScreen) {
                    return;
                  }

                  updateScreen(activeScreen.id, (screen) => ({
                    ...screen,
                    layout: {
                      ...screen.layout,
                      children: screen.layout.children.filter((_, candidateIndex) => candidateIndex !== index),
                    },
                  }));
                  setSelectedComponentIndex(null);
                }}
                onUpdateScreen={(updater) => activeScreen && updateScreen(activeScreen.id, updater)}
                onUpdateComponent={updateSelectedComponent}
                onOpenPreview={() => openPreviewDialog('nyife')}
              />
            ) : (
              <FlowNoticeCard
                title="Builder unavailable"
                description="This flow stays in JSON mode to avoid corrupting unsupported Meta JSON."
              >
                <p>{builderWarning || 'Switch to the JSON tab to review this flow safely.'}</p>
              </FlowNoticeCard>
            )}
          </TabsContent>

          <TabsContent value="json">
            <FlowJsonEditorCard
              jsonDraft={jsonDraft}
              isBusy={isBusy}
              readOnly={isReadOnly}
              onChange={(value) => {
                setJsonDraft(value);
                setHasUnsavedChanges(true);
                setHasBuilderEdits(true);
              }}
              onReset={() => setJsonDraft(JSON.stringify(mode === 'builder' ? currentBuilderJson : jsonDefinition, null, 2))}
              onApply={applyJsonDraft}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FlowPreviewDialog
        open={previewDialogOpen}
        onOpenChange={closePreviewDialog}
        title={previewState?.title || trimmedName || existing?.name || 'Flow preview'}
        definition={previewState?.definition || builderDefinition}
        builderSupported={previewState?.builderSupported ?? builderSupported}
        warning={previewState?.warning || builderWarning}
        initialTab={previewInitialTab}
        metaFlowId={previewState?.metaFlowId || existing?.meta_flow_id || null}
        previewUrl={previewState?.previewUrl || existing?.preview_url || null}
        previewExpiresAt={previewState?.previewExpiresAt || existing?.preview_expires_at || null}
        syncOfficialPreviewBeforeOpen={previewState?.syncOfficialPreviewBeforeOpen ?? false}
        onEnsureOfficialPreview={hasUnsupportedDataExchange ? undefined : prepareOfficialPreview}
        onRefreshOfficialPreview={existing?.id ? refreshOfficialPreview : undefined}
      />

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'publish'
                ? 'Publish flow to Meta?'
                : confirmAction === 'deprecate'
                  ? 'Deprecate this flow on Meta?'
                  : 'Delete this flow?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction === 'delete' ? 'destructive' : 'default'}
              onClick={(event) => {
                event.preventDefault();
                const currentAction = confirmAction;
                setConfirmAction(null);

                if (currentAction === 'publish') {
                  void runSaveAction('publish');
                  return;
                }

                if (currentAction === 'deprecate') {
                  if (!id) {
                    return;
                  }

                  deprecateFlow.mutate(id, {
                    onSuccess: () => {
                      toast.success('Flow deprecated successfully.');
                    },
                    onError: (error) => {
                      toast.error(getApiErrorMessage(error, 'Failed to deprecate flow.'));
                    },
                  });
                  return;
                }

                if (!id) {
                  return;
                }

                deleteFlow.mutate(id, {
                  onSuccess: () => {
                    toast.success('Flow deleted successfully.');
                    navigate('/flows');
                  },
                  onError: (error) => {
                    toast.error(getApiErrorMessage(error, 'Failed to delete flow.'));
                  },
                });
              }}
            >
              {confirmAction === 'publish'
                ? 'Publish'
                : confirmAction === 'deprecate'
                  ? 'Deprecate'
                  : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FlowBuilderPage;
