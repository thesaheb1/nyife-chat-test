import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Copy,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { FlowComponent, FlowDefinition, FlowScreen, WhatsAppFlow } from '@/core/types';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { FlowComponentInspector } from './FlowComponentInspector';
import { FlowComponentPreview } from './FlowComponentPreview';
import {
  createFlowComponent,
  createFlowDefinition,
  createFlowScreen,
  flowCategories,
  flowComponentPalette,
  getScreenDataExchangeConfig,
  moveItem,
  validateFlowDefinition,
} from './flowUtils';
import {
  useCreateFlow,
  useDeprecateFlow,
  useDuplicateFlow,
  useFlow,
  usePublishFlow,
  useSaveFlowToMeta,
  useUpdateFlow,
} from './useFlows';

export function FlowBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { data: existing, isLoading } = useFlow(id);
  const { data: waAccounts = [] } = useWhatsAppAccounts();
  const createFlow = useCreateFlow();
  const updateFlow = useUpdateFlow();
  const saveToMeta = useSaveFlowToMeta();
  const publishFlow = usePublishFlow();
  const deprecateFlow = useDeprecateFlow();
  const duplicateFlow = useDuplicateFlow();

  const [name, setName] = useState('Lead capture flow');
  const [wabaId, setWabaId] = useState('');
  const [waAccountId, setWaAccountId] = useState('');
  const [categories, setCategories] = useState<WhatsAppFlow['categories']>(['LEAD_GENERATION']);
  const [flowDefinition, setFlowDefinition] = useState<FlowDefinition>(() => createFlowDefinition('Lead capture flow'));
  const [editorState, setEditorState] = useState<Record<string, unknown>>({});
  const [dataExchangeConfig, setDataExchangeConfig] = useState<Record<string, unknown>>({});
  const [activeScreenId, setActiveScreenId] = useState('');
  const [selectedComponentIndex, setSelectedComponentIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const [jsonDraft, setJsonDraft] = useState('');

  useEffect(() => {
    if (!existing) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(existing.name);
    setWabaId(existing.waba_id || '');
    setWaAccountId(existing.wa_account_id || '');
    setCategories(existing.categories);
    setFlowDefinition(existing.json_definition);
    setEditorState(existing.editor_state || {});
    setDataExchangeConfig(existing.data_exchange_config || {});
    setActiveScreenId(String(existing.editor_state?.active_screen_id || existing.json_definition.screens[0]?.id || ''));
    setSelectedComponentIndex(typeof existing.editor_state?.selected_component_index === 'number' ? Number(existing.editor_state.selected_component_index) : null);
    setJsonDraft(JSON.stringify(existing.json_definition, null, 2));
  }, [existing]);

  useEffect(() => {
    if (!existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveScreenId((current) => current || flowDefinition.screens[0]?.id || '');
    }
  }, [existing, flowDefinition.screens]);

  useEffect(() => {
    if (mode === 'builder') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJsonDraft(JSON.stringify(flowDefinition, null, 2));
    }
  }, [flowDefinition, mode]);

  const activeScreen = useMemo(
    () => flowDefinition.screens.find((screen) => screen.id === activeScreenId) || flowDefinition.screens[0] || null,
    [activeScreenId, flowDefinition.screens]
  );
  const selectedComponent = activeScreen && selectedComponentIndex !== null
    ? activeScreen.layout.children[selectedComponentIndex] || null
    : null;
  const validationIssues = Array.from(new Set([
    ...(existing?.validation_errors || []),
    ...validateFlowDefinition(flowDefinition),
  ]));
  const dataSourceConfig = activeScreen ? getScreenDataExchangeConfig(dataExchangeConfig, activeScreen.id) : null;
  const wabaOptions = Array.from(
    new Map(
      waAccounts.map((account) => [
        account.waba_id,
        {
          value: account.waba_id,
          label: `${account.verified_name || account.display_phone || account.waba_id} (${account.waba_id})`,
          waAccountId: account.id,
        },
      ])
    ).values()
  );

  const updateScreen = (screenId: string, updater: (screen: FlowScreen) => FlowScreen) => {
    setFlowDefinition((current) => ({
      ...current,
      screens: current.screens.map((screen) => (screen.id === screenId ? updater(screen) : screen)),
    }));
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
      waba_id: wabaId || undefined,
      wa_account_id: waAccountId || undefined,
      categories,
      json_definition: flowDefinition,
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
      if (action === 'save') {
        toast.success('Flow saved successfully.');
      } else if (action === 'meta') {
        await saveToMeta.mutateAsync({ id: flow.id, waba_id: wabaId || undefined });
        toast.success('Flow saved to Meta successfully.');
      } else {
        await publishFlow.mutateAsync({ id: flow.id, waba_id: wabaId || undefined });
        toast.success('Flow published successfully.');
      }
      if (!isEdit) {
        navigate(`/flows/${flow.id}/edit`);
      }
    } catch (error) {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (error as Error).message
        || 'Flow action failed.'
      );
    }
  };

  const isBusy = createFlow.isPending || updateFlow.isPending || saveToMeta.isPending || publishFlow.isPending || deprecateFlow.isPending || duplicateFlow.isPending;

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/flows')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{isEdit ? 'Edit flow' : 'Create flow'}</h1>
            {existing?.status && <Badge variant="outline">{existing.status}</Badge>}
            {existing?.meta_flow_id && <Badge variant="secondary">Meta linked</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Build multi-screen WhatsApp Flows with a Whatomate-style screen rail, phone preview, inspector, JSON fallback, and Meta lifecycle actions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEdit && (
            <Button variant="outline" onClick={async () => {
              try {
                const flow = await duplicateFlow.mutateAsync(id!);
                toast.success('Flow duplicated successfully.');
                navigate(`/flows/${flow.id}/edit`);
              } catch (error) {
                toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to duplicate flow.');
              }
            }} disabled={isBusy}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </Button>
          )}
          {isEdit && (
            <Button variant="outline" onClick={async () => {
              try {
                await deprecateFlow.mutateAsync(id!);
                toast.success('Flow deprecated successfully.');
              } catch (error) {
                toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to deprecate flow.');
              }
            }} disabled={isBusy}>
              <Trash2 className="mr-2 h-4 w-4" />
              Deprecate
            </Button>
          )}
          <Button variant="outline" onClick={() => runSaveAction('meta')} disabled={isBusy}>
            <WandSparkles className="mr-2 h-4 w-4" />
            Save to Meta
          </Button>
          <Button variant="outline" onClick={() => runSaveAction('publish')} disabled={isBusy}>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>WABA</Label>
              <Select value={wabaId || 'manual'} onValueChange={(value) => {
                if (value === 'manual') {
                  setWabaId('');
                  return;
                }
                const selected = wabaOptions.find((option) => option.value === value);
                setWabaId(value);
                setWaAccountId(selected?.waAccountId || '');
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual entry</SelectItem>
                  {wabaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={wabaId} onChange={(event) => setWabaId(event.target.value)} placeholder="WhatsApp Business Account ID" />
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
                      onClick={() => setCategories((current) => {
                        if (active) {
                          const next = current.filter((item) => item !== category.value);
                          return next.length > 0 ? next : ['OTHER'];
                        }
                        return [...current, category.value];
                      })}
                      className={cn('rounded-full border px-3 py-1 text-xs transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {validationIssues.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-lg">Validation issues</CardTitle>
            <CardDescription>Drafts can still be saved, but Meta publish will be blocked until these are fixed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-amber-900">
            {validationIssues.map((issue) => <p key={issue}>- {issue}</p>)}
          </CardContent>
        </Card>
      )}

      <Tabs value={mode} onValueChange={(value) => setMode(value as 'builder' | 'json')} className="space-y-4">
        <TabsList>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
            <FlowScreenRail
              flowDefinition={flowDefinition}
              activeScreenId={activeScreen?.id || ''}
              onSelect={(screenId) => {
                setActiveScreenId(screenId);
                setSelectedComponentIndex(null);
              }}
              onAdd={() => {
                const screen = createFlowScreen();
                setFlowDefinition((current) => ({ ...current, screens: [...current.screens, screen] }));
                setActiveScreenId(screen.id);
              }}
              onMove={(fromIndex, toIndex) => setFlowDefinition((current) => ({ ...current, screens: moveItem(current.screens, fromIndex, toIndex) }))}
              onRemove={(screenId) => {
                if (flowDefinition.screens.length === 1) {
                  toast.error('At least one screen is required.');
                  return;
                }
                const remaining = flowDefinition.screens.filter((screen) => screen.id !== screenId);
                setFlowDefinition((current) => ({ ...current, screens: remaining }));
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
                  layout: { ...screen.layout, children: screen.layout.children.filter((_, candidateIndex) => candidateIndex !== index) },
                }));
                setSelectedComponentIndex(null);
              }}
            />

            <FlowInspectorPanel
              activeScreen={activeScreen}
              selectedComponent={selectedComponent}
              screens={flowDefinition.screens}
              dataSourceConfig={dataSourceConfig}
              onUpdateScreen={(updater) => activeScreen && updateScreen(activeScreen.id, updater)}
              onUpdateComponent={updateSelectedComponent}
              onUpdateDataSource={(next) => {
                if (!activeScreen) return;
                setDataExchangeConfig((current) => {
                  const updated = { ...current };
                  if (!next || next.source_type === 'none') {
                    delete updated[activeScreen.id];
                  } else {
                    updated[activeScreen.id] = next;
                  }
                  return updated;
                });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle>Structured JSON</CardTitle>
              <CardDescription>Paste an existing Meta-compatible flow definition or edit the generated schema directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} rows={28} className="font-mono text-xs" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setJsonDraft(JSON.stringify(flowDefinition, null, 2))}>Reset</Button>
                <Button onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonDraft) as FlowDefinition;
                    setFlowDefinition(parsed);
                    setActiveScreenId(parsed.screens[0]?.id || '');
                    setSelectedComponentIndex(null);
                    toast.success('JSON applied to the builder.');
                  } catch {
                    toast.error('JSON is not valid.');
                  }
                }}>Apply</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
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
            <button key={screen.id} type="button" onClick={() => props.onSelect(screen.id)} className={cn('w-full rounded-xl border p-3 text-left transition-colors', props.activeScreenId === screen.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40')}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{screen.title}</p><p className="text-xs text-muted-foreground">{screen.id}</p></div>
                <Badge variant="outline">{screen.layout.children.length}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMove(index, index - 1); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMove(index, index + 1); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(event) => { event.stopPropagation(); props.onRemove(screen.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </button>
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
              <div><p className="font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.description}</p></div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FlowPhoneCanvas(props: {
  activeScreen: FlowScreen | null;
  selectedComponentIndex: number | null;
  onSelect: (index: number | null) => void;
  onMoveComponent: (fromIndex: number, toIndex: number) => void;
  onRemoveComponent: (index: number) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-base">Phone preview</CardTitle>
        <CardDescription>Preview the active screen as a WhatsApp Flow.</CardDescription>
      </CardHeader>
      <CardContent className="bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
        <div className="mx-auto max-w-[360px] rounded-[32px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60">
          <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-slate-200" />
          {props.activeScreen ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-emerald-950 px-4 py-3 text-white">
                <p className="text-sm font-semibold">{props.activeScreen.title}</p>
                <p className="text-xs text-emerald-100">{props.activeScreen.id}</p>
              </div>
              {props.activeScreen.layout.children.map((component, index) => (
                <button key={`${props.activeScreen?.id}-${index}-${component.type}`} type="button" onClick={() => props.onSelect(index)} className={cn('w-full rounded-2xl border p-4 text-left transition-colors', props.selectedComponentIndex === index ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-primary/40')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><FlowComponentPreview component={component} /></div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMoveComponent(index, index - 1); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={(event) => { event.stopPropagation(); props.onMoveComponent(index, index + 1); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(event) => { event.stopPropagation(); props.onRemoveComponent(index); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Select or create a screen to start building.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FlowInspectorPanel(props: {
  activeScreen: FlowScreen | null;
  selectedComponent: FlowComponent | null;
  screens: FlowScreen[];
  dataSourceConfig: Record<string, unknown> | null;
  onUpdateScreen: (updater: (screen: FlowScreen) => FlowScreen) => void;
  onUpdateComponent: (updater: (component: FlowComponent) => FlowComponent) => void;
  onUpdateDataSource: (next: Record<string, unknown> | null) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{props.selectedComponent ? 'Component inspector' : 'Screen settings'}</CardTitle>
          <CardDescription>{props.selectedComponent ? 'Edit the selected component properties.' : 'Manage the active screen and its flow behavior.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {props.activeScreen && !props.selectedComponent && (
            <>
              <div className="space-y-2"><Label>Screen title</Label><Input value={props.activeScreen.title} onChange={(event) => props.onUpdateScreen((screen) => ({ ...screen, title: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Screen ID</Label><Input value={props.activeScreen.id} onChange={(event) => props.onUpdateScreen((screen) => ({ ...screen, id: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-medium">Terminal screen</p><p className="text-xs text-muted-foreground">Use this for final success or confirmation screens.</p></div><Switch checked={Boolean(props.activeScreen.terminal)} onCheckedChange={(checked) => props.onUpdateScreen((screen) => ({ ...screen, terminal: checked }))} /></div>
              <div className="space-y-2"><Label>Success message</Label><Textarea value={props.activeScreen.success_message || ''} onChange={(event) => props.onUpdateScreen((screen) => ({ ...screen, success_message: event.target.value }))} rows={3} /></div>
            </>
          )}
          {props.selectedComponent && <FlowComponentInspector component={props.selectedComponent} screens={props.screens} onChange={props.onUpdateComponent} />}
        </CardContent>
      </Card>

      {props.activeScreen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data exchange</CardTitle>
            <CardDescription>Configure dynamic data for this screen without exposing external URLs to Meta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Source type</Label>
              <Select value={String(props.dataSourceConfig?.source_type || 'none')} onValueChange={(value) => props.onUpdateDataSource(value === 'none' ? null : { ...(props.dataSourceConfig || {}), source_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="static">Static response</SelectItem>
                  <SelectItem value="http">HTTP source</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {String(props.dataSourceConfig?.source_type || 'none') === 'static' && (
              <div className="space-y-2"><Label>Static response JSON</Label><Textarea value={JSON.stringify(props.dataSourceConfig?.response || {}, null, 2)} onChange={(event) => props.onUpdateDataSource({ ...(props.dataSourceConfig || {}), source_type: 'static', response: safeJsonParse(event.target.value) })} rows={8} className="font-mono text-xs" /></div>
            )}
            {String(props.dataSourceConfig?.source_type || 'none') === 'http' && (
              <>
                <div className="space-y-2"><Label>HTTP URL</Label><Input value={String(props.dataSourceConfig?.url || '')} onChange={(event) => props.onUpdateDataSource({ ...(props.dataSourceConfig || {}), source_type: 'http', url: event.target.value })} placeholder="https://example.com/flow-data" /></div>
                <div className="space-y-2"><Label>Method</Label><Select value={String(props.dataSourceConfig?.method || 'POST')} onValueChange={(value) => props.onUpdateDataSource({ ...(props.dataSourceConfig || {}), source_type: 'http', method: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="POST">POST</SelectItem><SelectItem value="GET">GET</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Headers JSON</Label><Textarea value={JSON.stringify(props.dataSourceConfig?.headers || {}, null, 2)} onChange={(event) => props.onUpdateDataSource({ ...(props.dataSourceConfig || {}), source_type: 'http', headers: safeJsonParse(event.target.value) })} rows={5} className="font-mono text-xs" /></div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
