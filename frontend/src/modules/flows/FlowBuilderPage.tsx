import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  FlowCategory,
  FlowComponent,
  FlowDefinition,
  FlowScreen,
  MetaFlowDefinition,
  WhatsAppFlow,
} from '@/core/types';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { FlowBuilderHeader } from './FlowBuilderHeader';
import { FlowBuilderWorkspace } from './FlowBuilderWorkspace';
import { FlowImportJsonDialog } from './FlowImportJsonDialog';
import { FlowJsonEditorCard } from './FlowJsonEditorCard';
import { FlowMetadataPanel } from './FlowMetadataPanel';
import { FlowNoticeCard } from './FlowNoticeCard';
import {
  buildFlowPreviewPath,
  META_FLOW_MANAGER_URL,
  saveFlowPreviewSnapshot,
} from './flowPreview';
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
  useSaveFlowToMeta,
  useUpdateFlow,
} from './useFlows';

function parseJsonDraft(jsonDraft: string) {
  return JSON.parse(jsonDraft) as MetaFlowDefinition;
}

export function FlowBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const compactWorkspace = useMediaQuery('(max-width: 1279px)');
  const { data: existing, isLoading } = useFlow(id);
  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();
  const deleteFlow = useDeleteFlow();
  const saveToMeta = useSaveFlowToMeta();
  const publishFlow = usePublishFlow();
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
  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const [jsonDraft, setJsonDraft] = useState(JSON.stringify(initialFlowState.initialJson, null, 2));
  const [builderSupported, setBuilderSupported] = useState(true);
  const [builderWarning, setBuilderWarning] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [starterDirty, setStarterDirty] = useState(false);
  const [importJsonOpen, setImportJsonOpen] = useState(false);
  const [importJsonDraft, setImportJsonDraft] = useState('');
  const [screensSheetOpen, setScreensSheetOpen] = useState(false);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);

  const primaryCategory = categories[0] || 'OTHER';
  const trimmedName = name.trim();

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
    setStarterDirty(true);
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
    || deprecateFlow.isPending
    || duplicateFlow.isPending;

  const applyParsedJson = (
    parsed: MetaFlowDefinition,
    options: {
      nextMode?: 'builder' | 'json' | null;
      successMessage?: string;
    } = {}
  ) => {
    const derived = deriveBuilderStateFromMetaFlow(parsed);
    setStarterDirty(true);
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

  const buildCurrentJsonDefinition = () => {
    if (!trimmedName) {
      throw new Error('Flow name is required before saving or previewing.');
    }

    if (mode === 'json') {
      return parseJsonDraft(jsonDraft);
    }

    return currentBuilderJson;
  };

  const syncBuilderDefinition = (nextDefinition: FlowDefinition) => {
    setStarterDirty(true);
    setBuilderDefinition(nextDefinition);
    const compiled = compileMetaFlowDefinition(nextDefinition, trimmedName || 'Flow start');
    setJsonDefinition(compiled);
    setJsonDraft(JSON.stringify(compiled, null, 2));
  };

  const applyCategoryStarter = (category: FlowCategory) => {
    const starterDefinition = createFlowDefinition(trimmedName || 'Flow start', category);
    const compiled = compileMetaFlowDefinition(starterDefinition, trimmedName || 'Flow start');
    setStarterDirty(false);
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

  const updateScreen = (screenId: string, updater: (screen: FlowScreen) => FlowScreen) => {
    syncBuilderDefinition({
      ...builderDefinition,
      screens: builderDefinition.screens.map((screen) => (screen.id === screenId ? updater(screen) : screen)),
    });
  };

  const updateSelectedComponent = (updater: (component: FlowComponent) => FlowComponent) => {
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

    if (isEdit && id) {
      return updateFlow.mutateAsync({ id, ...payload });
    }

    return createFlow.mutateAsync(payload);
  };

  const runSaveAction = async (action: 'save' | 'meta' | 'publish') => {
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

      if (action === 'meta') {
        await saveToMeta.mutateAsync({ id: targetFlowId });
        toast.success('Flow saved to Meta successfully.');
        return;
      }

      await publishFlow.mutateAsync({ id: targetFlowId });
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

  const openPreviewWorkspace = () => {
    try {
      const nextJsonDefinition = buildCurrentJsonDefinition();
      setJsonDefinition(nextJsonDefinition);
      saveFlowPreviewSnapshot({
        source: isEdit ? 'edit' : 'create',
        flow_id: id || null,
        name: trimmedName || 'Flow preview',
        categories: [primaryCategory],
        json_definition: nextJsonDefinition,
        meta_flow_id: existing?.meta_flow_id || null,
        preview_url: existing?.preview_url || null,
        preview_expires_at: existing?.preview_expires_at || null,
        saved_at: new Date().toISOString(),
      });
      navigate(buildFlowPreviewPath({ source: isEdit ? 'edit' : 'create', flowId: id || null }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Fix the draft before opening preview.'));
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

  return (
    <>
      <div className="space-y-4">
        <FlowBuilderHeader
          isEdit={isEdit}
          flow={existing}
          isBusy={isBusy}
          hasUnsupportedDataExchange={hasUnsupportedDataExchange}
          onBack={() => navigate('/flows')}
          onOpenPreview={openPreviewWorkspace}
          onOpenOfficialPreview={() => {
            if (existing?.preview_url) {
              window.open(existing.preview_url, '_blank', 'noopener,noreferrer');
            }
          }}
          onOpenMetaFlowBuilder={() => window.open(META_FLOW_MANAGER_URL, '_blank', 'noopener,noreferrer')}
          onOpenImportJson={() => setImportJsonOpen(true)}
          onDuplicate={async () => {
            if (!id) {
              return;
            }

            try {
              const flow = await duplicateFlow.mutateAsync(id);
              toast.success('Flow duplicated successfully.');
              navigate(`/flows/${flow.id}/edit`);
            } catch (error) {
              toast.error(getApiErrorMessage(error, 'Failed to duplicate flow.'));
            }
          }}
          onDeprecate={async () => {
            if (!id) {
              return;
            }

            try {
              await deprecateFlow.mutateAsync(id);
              toast.success('Flow deprecated successfully.');
            } catch (error) {
              toast.error(getApiErrorMessage(error, 'Failed to deprecate flow.'));
            }
          }}
          onDelete={() => setDeleteConfirmOpen(true)}
          onSaveToMeta={() => void runSaveAction('meta')}
          onPublish={() => setPublishConfirmOpen(true)}
          onSaveDraft={() => void runSaveAction('save')}
        />

        <FlowMetadataPanel
          name={name}
          primaryCategory={primaryCategory}
          isBusy={isBusy}
          starterDirty={starterDirty}
          onNameChange={setName}
          onCategoryChange={(category) => {
            setCategories([category]);
            if (!isEdit && !starterDirty) {
              applyCategoryStarter(category);
            }
          }}
          onApplyStarter={() => applyCategoryStarter(primaryCategory)}
        />

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
              Save draft is still allowed, but Save to Meta and Publish are blocked until this configuration is cleared or phase 2 support is implemented.
            </p>
            <pre className="overflow-auto rounded-2xl bg-amber-100/70 p-3 text-xs text-amber-950">
              {JSON.stringify(dataExchangeConfig, null, 2)}
            </pre>
          </FlowNoticeCard>
        ) : null}

        {isEdit && existing?.meta_flow_id && existing.status === 'PUBLISHED' ? (
          <FlowNoticeCard
            title="Published flow editing"
            tone="info"
            description="Meta can edit supported published flows in place by moving them back to draft while applying updated JSON."
          >
            <p>
              Save draft stores local changes only. Save to Meta or Publish will try to move the linked Meta flow back to draft, apply the latest version, and publish again.
            </p>
            <p>
              If Meta rejects in-place editing for this account or an older linked flow, Nyife will show the Meta error so you can duplicate the flow manually instead.
            </p>
          </FlowNoticeCard>
        ) : null}

        {validationIssues.length > 0 ? (
          <FlowNoticeCard
            title="Validation issues"
            description="Drafts can still be saved, but Meta publish will be blocked until these issues are fixed."
          >
            {validationIssues.map((issue) => <p key={issue}>- {issue}</p>)}
          </FlowNoticeCard>
        ) : null}

        <Tabs value={mode} onValueChange={(value) => setMode(value as 'builder' | 'json')} className="space-y-4">
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
                onOpenPreview={openPreviewWorkspace}
              />
            ) : (
              <FlowNoticeCard
                title="Builder unavailable"
                description="This flow stays in JSON mode to avoid corrupting unsupported Meta JSON."
              >
                <p>{builderWarning || 'Switch to the JSON tab to edit this flow safely.'}</p>
              </FlowNoticeCard>
            )}
          </TabsContent>

          <TabsContent value="json">
            <FlowJsonEditorCard
              jsonDraft={jsonDraft}
              isBusy={isBusy}
              onChange={setJsonDraft}
              onReset={() => setJsonDraft(JSON.stringify(mode === 'builder' ? currentBuilderJson : jsonDefinition, null, 2))}
              onApply={applyJsonDraft}
              onOpenImport={() => setImportJsonOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FlowImportJsonDialog
        open={importJsonOpen}
        value={importJsonDraft}
        isBusy={isBusy}
        onOpenChange={setImportJsonOpen}
        onValueChange={setImportJsonDraft}
        onImport={() => {
          try {
            const parsed = parseJsonDraft(importJsonDraft);
            const derived = deriveBuilderStateFromMetaFlow(parsed);
            applyParsedJson(parsed, {
              nextMode: derived.supported ? 'builder' : 'json',
              successMessage: derived.supported
                ? 'Meta JSON imported into the builder successfully.'
                : 'Meta JSON imported. This flow stays in JSON mode because it uses unsupported builder features.',
            });
            setImportJsonOpen(false);
            setImportJsonDraft('');
          } catch {
            toast.error('Imported JSON is not valid.');
          }
        }}
      />

      <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish flow to Meta?</AlertDialogTitle>
            <AlertDialogDescription>
              Nyife will save the latest version to Meta, refresh validation and health status, and then publish the linked flow. If this flow is already published, Meta will move it back to draft while applying the updated version before publishing again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setPublishConfirmOpen(false);
                void runSaveAction('publish');
              }}
            >
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flow?</AlertDialogTitle>
            <AlertDialogDescription>
              Draft deletion is permanent in Nyife. If this flow is linked to a Meta draft, Nyife will delete that Meta draft first before removing the local record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (!id) {
                  return;
                }

                setDeleteConfirmOpen(false);
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FlowBuilderPage;
