import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/core/errors/apiError';
import type { FlowCategory, FlowComponent, FlowDefinition, FlowScreen, MetaFlowDefinition, WhatsAppFlow } from '@/core/types';
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
import { FlowComponentInspector } from './FlowComponentInspector';
import { FlowComponentPreview } from './FlowComponentPreview';
import { WhatsAppFlowPreview } from './WhatsAppFlowPreview';
import {
  compileMetaFlowDefinition,
  createFlowComponent,
  createFlowDefinition,
  createFlowScreen,
  deriveBuilderStateFromMetaFlow,
  flowCategories,
  flowComponentPalette,
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

function activateWithKeyboard(
  event: KeyboardEvent<HTMLElement>,
  onActivate: () => void
) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onActivate();
}

export function FlowBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
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
  const [jsonDraft, setJsonDraft] = useState('');
  const [builderSupported, setBuilderSupported] = useState(true);
  const [builderWarning, setBuilderWarning] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [starterDirty, setStarterDirty] = useState(false);

  const primaryCategory = categories[0] || 'OTHER';

  const syncBuilderDefinition = (nextDefinition: FlowDefinition) => {
    setStarterDirty(true);
    setBuilderDefinition(nextDefinition);
    const compiled = compileMetaFlowDefinition(nextDefinition, name.trim() || 'Flow start');
    setJsonDefinition(compiled);
    setJsonDraft(JSON.stringify(compiled, null, 2));
  };

  const applyCategoryStarter = (category: FlowCategory) => {
    const starterDefinition = createFlowDefinition(name.trim() || 'Flow start', category);
    const compiled = compileMetaFlowDefinition(starterDefinition, name.trim() || 'Flow start');
    setStarterDirty(false);
    setBuilderDefinition(starterDefinition);
    setJsonDefinition(compiled);
    setJsonDraft(JSON.stringify(compiled, null, 2));
    setBuilderSupported(true);
    setBuilderWarning(null);
    setMode('builder');
    setActiveScreenId(starterDefinition.screens[0]?.id || '');
    setSelectedComponentIndex(null);
  };

  useEffect(() => {
    if (!existing) {
      return;
    }

    const derived = deriveBuilderStateFromMetaFlow(existing.json_definition);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(existing.name);
    setCategories(existing.categories);
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

  const localValidationIssues = builderSupported ? validateFlowDefinition(builderDefinition) : [];
  const remoteValidationIssues = (existing?.validation_error_details || [])
    .map((detail) => formatValidationDetail(detail))
    .concat((existing?.validation_errors || []).filter((entry) => !(existing?.validation_error_details || []).some((detail) => formatValidationDetail(detail) === entry)));
  const validationIssues = Array.from(new Set([
    ...remoteValidationIssues,
    ...localValidationIssues,
  ]));

  const hasUnsupportedDataExchange = Object.keys(dataExchangeConfig || {}).length > 0;
  const isBusy = createFlow.isPending
    || updateFlow.isPending
    || deleteFlow.isPending
    || saveToMeta.isPending
    || publishFlow.isPending
    || deprecateFlow.isPending
    || duplicateFlow.isPending;

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
    const payload = {
      name: name.trim(),
      categories,
      json_definition: jsonDefinition,
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
      const parsed = JSON.parse(jsonDraft) as MetaFlowDefinition;
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
        toast.success('Meta JSON applied to the visual builder.');
      } else {
        setMode('json');
        toast.success('Meta JSON applied. This flow stays in JSON mode because it uses unsupported builder features.');
      }
    } catch {
      toast.error('JSON is not valid.');
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
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/flows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{isEdit ? 'Edit flow' : 'Create flow'}</h1>
              {existing?.status ? <Badge variant="outline">{existing.status}</Badge> : null}
              {existing?.meta_status && existing.meta_status !== existing.status ? <Badge variant="secondary">{existing.meta_status}</Badge> : null}
              {existing?.meta_flow_id ? <Badge variant="secondary">Meta linked</Badge> : null}
              {existing?.can_send_message === false ? <Badge variant="destructive">Send blocked</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Build static WhatsApp Flows, preview them locally in a WhatsApp-style shell, and publish Meta-compatible JSON with live validation before it reaches customers.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {existing?.preview_url ? (
              <Button variant="outline" asChild>
                <a href={existing.preview_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Meta preview
                </a>
              </Button>
            ) : null}
            {isEdit ? (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const flow = await duplicateFlow.mutateAsync(id!);
                    toast.success('Flow duplicated successfully.');
                    navigate(`/flows/${flow.id}/edit`);
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, 'Failed to duplicate flow.'));
                  }
                }}
                disabled={isBusy}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
            ) : null}
            {isEdit && existing?.meta_flow_id && existing.status !== 'DEPRECATED' ? (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await deprecateFlow.mutateAsync(id!);
                    toast.success('Flow deprecated successfully.');
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, 'Failed to deprecate flow.'));
                  }
                }}
                disabled={isBusy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deprecate
              </Button>
            ) : null}
            {isEdit ? (
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(true)} disabled={isBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => runSaveAction('meta')} disabled={isBusy || hasUnsupportedDataExchange}>
              <WandSparkles className="mr-2 h-4 w-4" />
              Save to Meta
            </Button>
            <Button variant="outline" onClick={() => setPublishConfirmOpen(true)} disabled={isBusy || hasUnsupportedDataExchange}>
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
            <Button onClick={() => runSaveAction('save')} disabled={isBusy}>
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-2">
              <Label>Flow name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2 rounded-md border p-3">
                {flowCategories.map((category) => {
                  const active = categories.includes(category.value);
                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => {
                        const nextCategories: FlowCategory[] = active
                          ? (() => {
                            const next = categories.filter((item) => item !== category.value);
                            return next.length > 0 ? next : ['OTHER'];
                          })()
                          : [...categories, category.value];

                        setCategories(nextCategories);
                        if (!isEdit && !starterDirty) {
                          applyCategoryStarter(nextCategories[0] || 'OTHER');
                        }
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>The first selected category controls the starter flow.</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => applyCategoryStarter(primaryCategory)}
                  disabled={isBusy}
                >
                  Apply category starter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {builderWarning ? (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-lg">Visual builder limited</CardTitle>
              <CardDescription>
                Nyife will keep this flow safe in JSON mode because the current Meta definition uses features outside the supported static builder subset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-amber-900">
              <p>{builderWarning}</p>
            </CardContent>
          </Card>
        ) : null}

        {hasUnsupportedDataExchange ? (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-lg">Data exchange deferred</CardTitle>
              <CardDescription>
                Endpoint-powered data exchange is explicitly out of scope for this production hardening round.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-amber-900">
              <p>Save draft is still allowed, but Save to Meta and Publish are blocked until this configuration is cleared or phase 2 support is implemented.</p>
              <pre className="overflow-auto rounded-lg bg-amber-100/70 p-3 text-xs text-amber-950">
                {JSON.stringify(dataExchangeConfig, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ) : null}

        {isEdit && existing?.meta_flow_id && existing.status === 'PUBLISHED' ? (
          <Card className="border-sky-200 bg-sky-50/70">
            <CardHeader>
              <CardTitle className="text-lg">Published flow editing</CardTitle>
              <CardDescription>
                Meta can edit supported published flows in place by moving them back to draft while applying the updated JSON.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-sky-950">
              <p>Save draft stores your local changes only. Save to Meta or Publish will try to move the linked Meta flow back to draft, apply the latest version, and then publish again.</p>
              <p>If Meta rejects in-place editing for this business account or this older flow, Nyife will show the Meta error so you can duplicate the flow manually instead.</p>
            </CardContent>
          </Card>
        ) : null}

        {validationIssues.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardHeader>
              <CardTitle className="text-lg">Validation issues</CardTitle>
              <CardDescription>Drafts can still be saved, but Meta publish will be blocked until these are fixed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-amber-900">
              {validationIssues.map((issue) => <p key={issue}>- {issue}</p>)}
            </CardContent>
          </Card>
        ) : null}

        <Tabs value={mode} onValueChange={(value) => setMode(value as 'builder' | 'json')} className="space-y-4">
          <TabsList>
            <TabsTrigger value="builder" disabled={!builderSupported}>Builder</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="builder">
            {builderSupported ? (
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
                <FlowScreenRail
                  flowDefinition={builderDefinition}
                  activeScreenId={activeScreen?.id || ''}
                  onSelect={(screenId) => {
                    setActiveScreenId(screenId);
                    setSelectedComponentIndex(null);
                  }}
                  onAdd={() => {
                    const screen = createFlowScreen();
                    syncBuilderDefinition({ ...builderDefinition, screens: [...builderDefinition.screens, screen] });
                    setActiveScreenId(screen.id);
                  }}
                  onMove={(fromIndex, toIndex) => syncBuilderDefinition({
                    ...builderDefinition,
                    screens: moveItem(builderDefinition.screens, fromIndex, toIndex),
                  })}
                  onRemove={(screenId) => {
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
                    if (!activeScreen) return;
                    updateScreen(activeScreen.id, (screen) => ({
                      ...screen,
                      layout: { ...screen.layout, children: [...screen.layout.children, createFlowComponent(type)] },
                    }));
                    setSelectedComponentIndex(activeScreen.layout.children.length);
                  }}
                />

                <FlowPhoneCanvas
                  definition={builderDefinition}
                  activeScreen={activeScreen}
                  selectedComponentIndex={selectedComponentIndex}
                  onSelect={setSelectedComponentIndex}
                  onMoveComponent={(fromIndex, toIndex) => {
                    if (!activeScreen || toIndex < 0 || toIndex >= activeScreen.layout.children.length) return;
                    updateScreen(activeScreen.id, (screen) => ({
                      ...screen,
                      layout: { ...screen.layout, children: moveItem(screen.layout.children, fromIndex, toIndex) },
                    }));
                    setSelectedComponentIndex(toIndex);
                  }}
                  onRemoveComponent={(index) => {
                    if (!activeScreen) return;
                    updateScreen(activeScreen.id, (screen) => ({
                      ...screen,
                      layout: {
                        ...screen.layout,
                        children: screen.layout.children.filter((_, candidateIndex) => candidateIndex !== index),
                      },
                    }));
                    setSelectedComponentIndex(null);
                  }}
                />

                <FlowInspectorPanel
                  activeScreen={activeScreen}
                  selectedComponent={selectedComponent}
                  screens={builderDefinition.screens}
                  onUpdateScreen={(updater) => activeScreen && updateScreen(activeScreen.id, updater)}
                  onUpdateComponent={updateSelectedComponent}
                />
              </div>
            ) : (
              <Card className="border-amber-200 bg-amber-50/60">
                <CardHeader>
                  <CardTitle className="text-lg">Builder unavailable</CardTitle>
                  <CardDescription>This flow stays in JSON mode to avoid corrupting unsupported Meta JSON.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-amber-900">
                  {builderWarning || 'Switch to the JSON tab to edit this flow safely.'}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="json">
            <Card>
              <CardHeader>
                <CardTitle>Canonical Meta JSON</CardTitle>
                <CardDescription>
                  Edit the exact Meta Flow JSON stored in Nyife. Supported static flows can still round-trip back into the visual builder.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} rows={28} className="font-mono text-xs" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setJsonDraft(JSON.stringify(jsonDefinition, null, 2))}>Reset</Button>
                  <Button onClick={applyJsonDraft}>Apply</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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

function FlowScreenRail(props: {
  flowDefinition: FlowDefinition;
  activeScreenId: string;
  onSelect: (screenId: string) => void;
  onAdd: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (screenId: string) => void;
  onAddComponent: (type: FlowComponent['type']) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Screens</CardTitle>
            <CardDescription>Organize screens in the journey.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={props.onAdd}><Plus className="mr-2 h-4 w-4" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {props.flowDefinition.screens.map((screen, index) => (
            <div
              key={screen.id}
              role="button"
              tabIndex={0}
              onClick={() => props.onSelect(screen.id)}
              onKeyDown={(event) => activateWithKeyboard(event, () => props.onSelect(screen.id))}
              className={cn(
                'w-full rounded-xl border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                props.activeScreenId === screen.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{screen.title}</p>
                  <p className="text-xs text-muted-foreground">{screen.id}</p>
                </div>
                <Badge variant="outline">{screen.layout.children.length}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMove(index, index - 1); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMove(index, index + 1); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(event) => { event.stopPropagation(); props.onRemove(screen.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Component library</CardTitle>
          <CardDescription>Add WhatsApp Flow blocks to the active screen.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {flowComponentPalette.map((item) => (
            <Button key={item.type} type="button" variant="outline" className="h-auto items-start justify-start whitespace-normal p-3 text-left" onClick={() => props.onAddComponent(item.type)}>
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FlowPhoneCanvas(props: {
  definition: FlowDefinition;
  activeScreen: FlowScreen | null;
  selectedComponentIndex: number | null;
  onSelect: (index: number | null) => void;
  onMoveComponent: (fromIndex: number, toIndex: number) => void;
  onRemoveComponent: (index: number) => void;
}) {
  const [phoneMode, setPhoneMode] = useState<'canvas' | 'preview'>('canvas');
  const activeScreen = props.activeScreen;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Phone preview</CardTitle>
            <CardDescription>Switch between the editable canvas and a live static-flow preview.</CardDescription>
          </div>
          <Tabs value={phoneMode} onValueChange={(value) => setPhoneMode(value as 'canvas' | 'preview')}>
            <TabsList>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="preview">Live preview</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
        {phoneMode === 'preview' ? (
          <WhatsAppFlowPreview
            definition={props.definition}
            className="mx-auto max-w-[28rem]"
          />
        ) : (
          <div className="mx-auto max-w-90 rounded-[32px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
            <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-slate-200" />
            {activeScreen ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-emerald-950 px-4 py-3 text-white">
                <p className="text-sm font-semibold">{activeScreen.title}</p>
                <p className="text-xs text-emerald-100">{activeScreen.id}</p>
              </div>
              {activeScreen.layout.children.map((component, index) => (
                <div
                  key={`${activeScreen.id}-${index}-${component.type}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => props.onSelect(index)}
                  onKeyDown={(event) => activateWithKeyboard(event, () => props.onSelect(index))}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30',
                    props.selectedComponentIndex === index ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-primary/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><FlowComponentPreview component={component} /></div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMoveComponent(index, index - 1); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMoveComponent(index, index + 1); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(event) => { event.stopPropagation(); props.onRemoveComponent(index); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Select or create a screen to start building.</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlowInspectorPanel(props: {
  activeScreen: FlowScreen | null;
  selectedComponent: FlowComponent | null;
  screens: FlowScreen[];
  onUpdateScreen: (updater: (screen: FlowScreen) => FlowScreen) => void;
  onUpdateComponent: (updater: (component: FlowComponent) => FlowComponent) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{props.selectedComponent ? 'Component inspector' : 'Screen settings'}</CardTitle>
          <CardDescription>{props.selectedComponent ? 'Edit the selected component properties.' : 'Manage the active screen and its flow behavior.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {props.activeScreen && !props.selectedComponent ? (
            <>
              <div className="space-y-2">
                <Label>Screen title</Label>
                <Input value={props.activeScreen.title} onChange={(event) => props.onUpdateScreen((screen) => ({ ...screen, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Screen ID</Label>
                <Input
                  value={props.activeScreen.id}
                  onChange={(event) => props.onUpdateScreen((screen) => ({
                    ...screen,
                    id: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                  }))}
                />
              </div>
            </>
          ) : null}
          {props.selectedComponent ? <FlowComponentInspector component={props.selectedComponent} screens={props.screens} onChange={props.onUpdateComponent} /> : null}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Static-flow scope</CardTitle>
          <CardDescription>Endpoint-powered data exchange is intentionally deferred so this builder stays aligned with the current Meta publish contract.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>Use the JSON tab for advanced imported flows, but clear any data exchange config before Save to Meta or Publish in this phase.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
