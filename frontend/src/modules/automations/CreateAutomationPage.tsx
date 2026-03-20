import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useAutomation, useCreateAutomation, useUpdateAutomation } from './useAutomations';
import { createAutomationSchema } from './validations';
import type { CreateAutomationFormData } from './validations';
import {
  buildActionConfig,
  buildConditions,
  buildTriggerConfig,
  createDefaultFlowEditorState,
  createDefaultJsonConfigs,
  hasUnsupportedBuilderConfig,
  hydrateApiAction,
  hydrateBasicReplyAction,
  hydrateFlowEditor,
  hydrateTimeWindow,
  hydrateTriggerBuilder,
  hydrateWebhookAction,
  parseJsonObject,
  type ApiActionState,
  type BasicReplyActionState,
  type EditorMode,
  type FlowEditorState,
  type TimeWindowState,
  type TriggerBuilderState,
  type TriggerType,
  type WebhookActionState,
} from './builder';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { buildActivePhoneNumberOptions } from '@/modules/whatsapp/accountOptions';
import { AutomationFlowEditor } from './flow-editor/AutomationFlowEditor';
import { useTemplates } from '@/modules/templates/useTemplates';
import { useTags } from '@/modules/contacts/useContacts';
import { useFlows } from '@/modules/flows/useFlows';
import { flowCategories } from '@/modules/flows/flowUtils';
import { useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';

export function CreateAutomationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: existing } = useAutomation(id);
  const { data: waAccounts } = useWhatsAppAccounts();
  const { data: tags = [] } = useTags();
  const createAuto = useCreateAutomation();
  const updateAuto = useUpdateAutomation();
  const [editorMode, setEditorMode] = useState<EditorMode>('builder');
  const [jsonDirty, setJsonDirty] = useState(false);
  const [jsonConfigs, setJsonConfigs] = useState(createDefaultJsonConfigs);
  const [triggerBuilder, setTriggerBuilder] = useState<TriggerBuilderState>({
    trigger_type: 'keyword',
    trigger_value: 'hello',
    match_case: false,
    flow_id: '',
    flow_screen_id: '',
    flow_category: '',
  });
  const [timeWindow, setTimeWindow] = useState<TimeWindowState>({ enabled: false, from_hour: '', to_hour: '' });
  const [basicReplyAction, setBasicReplyAction] = useState<BasicReplyActionState>({ body: 'Hi! How can I help?' });
  const [webhookAction, setWebhookAction] = useState<WebhookActionState>({ webhook_url: '', secret: '', headersText: '{}' });
  const [apiAction, setApiAction] = useState<ApiActionState>({ api_url: '', api_method: 'POST', api_headers_text: '{}', api_payload_text: '{}', reply_body: '' });
  const [flowEditor, setFlowEditor] = useState<FlowEditorState>(createDefaultFlowEditorState);

  const { control, register, handleSubmit, setValue, formState: { errors } } = useForm<CreateAutomationFormData>({
    resolver: zodResolver(createAutomationSchema),
    defaultValues: { name: '', description: '', type: 'basic_reply', wa_account_id: '', priority: 0 },
    mode: 'onChange',
  });

  const automationType = useWatch({ control, name: 'type' });
  const selectedAccountId = useWatch({ control, name: 'wa_account_id' });
  const selectedAccount = (waAccounts || []).find((account) => account.id === selectedAccountId);
  const phoneNumberOptions = buildActivePhoneNumberOptions(waAccounts);
  const { data: templatesData } = useTemplates({
    limit: 100,
    status: 'approved',
    waba_id: selectedAccount?.waba_id,
  });
  const { data: flowsData } = useFlows({
    limit: 100,
    waba_id: selectedAccount?.waba_id,
  });
  const templates = templatesData?.data.templates || [];
  const flows = flowsData?.flows || [];
  const selectedTriggerFlow = flows.find((flow) => flow.id === triggerBuilder.flow_id);
  const isPending = createAuto.isPending || updateAuto.isPending;
  const actionFieldsFilled =
    automationType === 'basic_reply'
      ? basicReplyAction.body.trim().length > 0
      : automationType === 'webhook_trigger'
        ? webhookAction.webhook_url.trim().length > 0
        : automationType === 'api_trigger'
          ? apiAction.api_url.trim().length > 0
          : true;
  const requiredFieldsFilled = useRequiredFieldsFilled(control, [
    'name',
    'type',
    'wa_account_id',
  ]);
  const isSubmitDisabled =
    isPending || !requiredFieldsFilled || !actionFieldsFilled || Object.keys(errors).length > 0;

  useEffect(() => {
    if (jsonDirty) {
      return;
    }
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJsonConfigs({
        trigger: JSON.stringify(buildTriggerConfig(triggerBuilder), null, 2),
        action: JSON.stringify(buildActionConfig(automationType, basicReplyAction, webhookAction, apiAction, flowEditor), null, 2),
      });
    } catch {
      // Ignore partial builder states while the user is typing.
    }
  }, [automationType, apiAction, basicReplyAction, flowEditor, jsonDirty, triggerBuilder, webhookAction]);

  useEffect(() => {
    if (!existing) {
      return;
    }
    setValue('name', existing.name);
    setValue('description', existing.description || '');
    setValue('type', existing.type);
    setValue('wa_account_id', existing.wa_account_id);
    setValue('priority', existing.priority || 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTriggerBuilder(hydrateTriggerBuilder(existing.trigger_config));
    setTimeWindow(hydrateTimeWindow(existing.conditions));
    setBasicReplyAction(hydrateBasicReplyAction(existing.action_config));
    setWebhookAction(hydrateWebhookAction(existing.action_config));
    setApiAction(hydrateApiAction(existing.action_config));
    setFlowEditor(hydrateFlowEditor(existing.action_config));
    setJsonConfigs({ trigger: JSON.stringify(existing.trigger_config || {}, null, 2), action: JSON.stringify(existing.action_config || {}, null, 2) });
    setJsonDirty(true);
    if (hasUnsupportedBuilderConfig(existing.type, existing.trigger_config, existing.action_config)) {
      setEditorMode('json');
    }
  }, [existing, setValue]);

  const syncJsonFromBuilder = () => {
    try {
      setJsonConfigs({
        trigger: JSON.stringify(buildTriggerConfig(triggerBuilder), null, 2),
        action: JSON.stringify(buildActionConfig(automationType, basicReplyAction, webhookAction, apiAction, flowEditor), null, 2),
      });
      setJsonDirty(false);
      toast.success('JSON reloaded from builder.');
    } catch (error) {
      toast.error((error as Error).message || 'Finish the builder fields first.');
    }
  };

  const onSubmit = async (data: CreateAutomationFormData) => {
    try {
      const triggerConfig = editorMode === 'json' ? parseJsonObject(jsonConfigs.trigger, 'Trigger config') : buildTriggerConfig(triggerBuilder);
      const actionConfig = editorMode === 'json' ? parseJsonObject(jsonConfigs.action, 'Action config') : buildActionConfig(data.type, basicReplyAction, webhookAction, apiAction, flowEditor);
      const conditions = buildConditions(timeWindow);
      const payload = { name: data.name, description: data.description || undefined, type: data.type, wa_account_id: data.wa_account_id, priority: Number(data.priority || 0), trigger_config: triggerConfig, action_config: actionConfig, conditions };
      if (isEdit && id) {
        await updateAuto.mutateAsync({ id, ...payload });
        toast.success('Automation updated');
      } else {
        await createAuto.mutateAsync(payload);
        toast.success('Automation created');
      }
      navigate('/automations');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save automation.'));
    }
  };

  return (
    <div className="mx-auto max-w-425 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Automation' : 'Create Automation'}</h1>
          <p className="text-sm text-muted-foreground">Build tenant-scoped fallback replies, API/webhook hooks, and multi-step WhatsApp flows.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Basics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label required>Name</Label><Input {...register('name')} placeholder="Fallback welcome" />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
              <div className="space-y-2"><Label>Priority</Label><Input type="number" min="0" {...register('priority', { valueAsNumber: true })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea {...register('description')} rows={3} placeholder="Internal notes for your team" /></div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label required>Type</Label>
                <Select
                  value={automationType}
                  onValueChange={(value) =>
                    setValue('type', value as CreateAutomationFormData['type'], {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic_reply">Basic Reply</SelectItem>
                    <SelectItem value="advanced_flow">Advanced Flow</SelectItem>
                    <SelectItem value="webhook_trigger">Webhook Trigger</SelectItem>
                    <SelectItem value="api_trigger">API Trigger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label required>Phone number</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={(value) =>
                    setValue('wa_account_id', value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select phone number" /></SelectTrigger>
                  <SelectContent>
                    {phoneNumberOptions.map((account) => (
                      <SelectItem key={account.value} value={account.value}>{account.label}</SelectItem>
                    ))}
                    {phoneNumberOptions.length === 0 ? (
                      <SelectItem value="none" disabled>No active phone numbers connected</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
                {errors.wa_account_id && <p className="text-xs text-destructive">{errors.wa_account_id.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={editorMode} onValueChange={(value) => setEditorMode(value as EditorMode)}>
          <div className="flex items-center justify-between">
            <div><h2 className="text-lg font-semibold">Logic</h2><p className="text-sm text-muted-foreground">The builder handles the common flows. JSON mode stays available for custom payloads.</p></div>
            <TabsList><TabsTrigger value="builder">Builder</TabsTrigger><TabsTrigger value="json">JSON</TabsTrigger></TabsList>
          </div>

          <TabsContent value="builder" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Trigger</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto]">
                  <div className="space-y-2">
                    <Label>Trigger Type</Label>
                    <Select value={triggerBuilder.trigger_type} onValueChange={(value) => setTriggerBuilder((current) => ({
                      ...current,
                      trigger_type: value as TriggerType,
                      trigger_value: value === 'fallback' || value === 'flow_submission' ? '' : current.trigger_value,
                    }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="keyword">Keyword contains</SelectItem>
                        <SelectItem value="exact">Exact match</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                        <SelectItem value="message_type">Message type</SelectItem>
                        <SelectItem value="flow_submission">Flow submission</SelectItem>
                        <SelectItem value="fallback">Fallback</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {triggerBuilder.trigger_type === 'flow_submission' ? (
                    <div className="grid gap-4 lg:col-span-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Flow</Label>
                        <Select value={triggerBuilder.flow_id || '__all__'} onValueChange={(value) => setTriggerBuilder((current) => ({
                          ...current,
                          flow_id: value === '__all__' ? '' : value,
                          flow_screen_id:
                            value === '__all__'
                              ? ''
                              : flows.find((flow) => flow.id === value)?.json_definition.screens[0]?.id || current.flow_screen_id,
                        }))}>
                          <SelectTrigger><SelectValue placeholder="Any flow" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Any flow</SelectItem>
                            {flows.map((flow) => (
                              <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Screen</Label>
                        <Select value={triggerBuilder.flow_screen_id || '__all__'} onValueChange={(value) => setTriggerBuilder((current) => ({ ...current, flow_screen_id: value === '__all__' ? '' : value }))}>
                          <SelectTrigger><SelectValue placeholder="Any screen" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Any screen</SelectItem>
                            {(selectedTriggerFlow?.json_definition.screens || []).map((screen) => (
                              <SelectItem key={screen.id} value={screen.id}>{screen.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={triggerBuilder.flow_category || '__all__'} onValueChange={(value) => setTriggerBuilder((current) => ({ ...current, flow_category: value === '__all__' ? '' : value }))}>
                          <SelectTrigger><SelectValue placeholder="Any category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">Any category</SelectItem>
                            {flowCategories.map((categoryOption) => (
                              <SelectItem key={categoryOption.value} value={categoryOption.value}>{categoryOption.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : triggerBuilder.trigger_type !== 'fallback' ? (
                    <div className="space-y-2">
                      <Label>{triggerBuilder.trigger_type === 'message_type' ? 'Message Type' : 'Trigger Value'}</Label>
                      {triggerBuilder.trigger_type === 'message_type' ? (
                        <Select value={triggerBuilder.trigger_value || 'text'} onValueChange={(value) => setTriggerBuilder((current) => ({ ...current, trigger_value: value }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="document">Document</SelectItem><SelectItem value="location">Location</SelectItem><SelectItem value="interactive">Interactive</SelectItem></SelectContent>
                        </Select>
                      ) : (
                        <Input value={triggerBuilder.trigger_value} onChange={(event) => setTriggerBuilder((current) => ({ ...current, trigger_value: event.target.value }))} placeholder={triggerBuilder.trigger_type === 'regex' ? '^help|support$' : 'hello'} />
                      )}
                    </div>
                  ) : null}
                  {triggerBuilder.trigger_type !== 'fallback' && triggerBuilder.trigger_type !== 'message_type' && triggerBuilder.trigger_type !== 'flow_submission' && (
                    <div className="space-y-2"><Label>Case Sensitive</Label><div className="flex h-10 items-center"><Switch checked={triggerBuilder.match_case} onCheckedChange={(checked) => setTriggerBuilder((current) => ({ ...current, match_case: checked }))} /></div></div>
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between"><div><p className="font-medium">Time Window</p><p className="text-sm text-muted-foreground">Optional daily hour range.</p></div><Switch checked={timeWindow.enabled} onCheckedChange={(checked) => setTimeWindow((current) => ({ ...current, enabled: checked }))} /></div>
                  {timeWindow.enabled && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2"><Label>From hour</Label><Input type="number" min="0" max="23" value={timeWindow.from_hour} onChange={(event) => setTimeWindow((current) => ({ ...current, from_hour: event.target.value }))} /></div>
                      <div className="space-y-2"><Label>To hour</Label><Input type="number" min="0" max="23" value={timeWindow.to_hour} onChange={(event) => setTimeWindow((current) => ({ ...current, to_hour: event.target.value }))} /></div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {automationType === 'basic_reply' && <Card><CardHeader><CardTitle className="text-lg">Reply</CardTitle></CardHeader><CardContent><div className="space-y-2"><Label required>Reply Message</Label><Textarea value={basicReplyAction.body} onChange={(event) => setBasicReplyAction({ body: event.target.value })} rows={5} placeholder="Hi! How can I help?" />{!actionFieldsFilled ? <p className="text-xs text-destructive">Reply message is required.</p> : null}</div></CardContent></Card>}

            {automationType === 'webhook_trigger' && <Card><CardHeader><CardTitle className="text-lg">Webhook Delivery</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label required>Webhook URL</Label><Input value={webhookAction.webhook_url} onChange={(event) => setWebhookAction((current) => ({ ...current, webhook_url: event.target.value }))} placeholder="https://example.com/whatsapp-hook" />{!actionFieldsFilled ? <p className="text-xs text-destructive">Webhook URL is required.</p> : null}</div><div className="space-y-2"><Label>Signing Secret</Label><Input value={webhookAction.secret} onChange={(event) => setWebhookAction((current) => ({ ...current, secret: event.target.value }))} placeholder="Optional HMAC secret" /></div></div><div className="space-y-2"><Label>Headers (JSON)</Label><Textarea value={webhookAction.headersText} onChange={(event) => setWebhookAction((current) => ({ ...current, headersText: event.target.value }))} rows={6} className="font-mono text-xs" /></div></CardContent></Card>}

            {automationType === 'api_trigger' && <Card><CardHeader><CardTitle className="text-lg">API Trigger</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-[1fr_180px]"><div className="space-y-2"><Label required>API URL</Label><Input value={apiAction.api_url} onChange={(event) => setApiAction((current) => ({ ...current, api_url: event.target.value }))} placeholder="https://example.com/api/lead" />{!actionFieldsFilled ? <p className="text-xs text-destructive">API URL is required.</p> : null}</div><div className="space-y-2"><Label>Method</Label><Select value={apiAction.api_method} onValueChange={(value) => setApiAction((current) => ({ ...current, api_method: value as ApiActionState['api_method'] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="POST">POST</SelectItem><SelectItem value="GET">GET</SelectItem><SelectItem value="PUT">PUT</SelectItem><SelectItem value="PATCH">PATCH</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><Label>Headers (JSON)</Label><Textarea value={apiAction.api_headers_text} onChange={(event) => setApiAction((current) => ({ ...current, api_headers_text: event.target.value }))} rows={7} className="font-mono text-xs" /></div><div className="space-y-2"><Label>Payload (JSON)</Label><Textarea value={apiAction.api_payload_text} onChange={(event) => setApiAction((current) => ({ ...current, api_payload_text: event.target.value }))} rows={7} className="font-mono text-xs" /></div></div><div className="space-y-2"><Label>Optional WhatsApp Reply</Label><Textarea value={apiAction.reply_body} onChange={(event) => setApiAction((current) => ({ ...current, reply_body: event.target.value }))} rows={4} placeholder="We'll get back to you shortly." /></div></CardContent></Card>}

            {automationType === 'advanced_flow' && (
              <Card>
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle className="text-lg">Automation Journey Builder</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Drag blocks from the left, connect paths on the canvas, and configure each node from the inspector. The flow is stored in the same runtime format the backend already executes.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AutomationFlowEditor
                    value={flowEditor}
                    onChange={setFlowEditor}
                    templates={templates}
                    tags={tags}
                    flows={flows}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="json" className="space-y-6">
            <Card>
              <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-lg">Manual JSON</CardTitle><p className="text-sm text-muted-foreground">Keep full control when you need a config shape the builder does not cover.</p></div><Button type="button" variant="outline" onClick={syncJsonFromBuilder}>Reload from builder</Button></div></CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2"><Label>Trigger Config</Label><Textarea value={jsonConfigs.trigger} onChange={(event) => { setJsonDirty(true); setJsonConfigs((current) => ({ ...current, trigger: event.target.value })); }} rows={16} className="font-mono text-xs" /></div>
                <div className="space-y-2"><Label>Action Config</Label><Textarea value={jsonConfigs.action} onChange={(event) => { setJsonDirty(true); setJsonConfigs((current) => ({ ...current, action: event.target.value })); }} rows={16} className="font-mono text-xs" /></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/automations')}>Cancel</Button>
          <Button type="submit" disabled={isSubmitDisabled}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isEdit ? 'Update Automation' : 'Create Automation'}</Button>
        </div>
      </form>
    </div>
  );
}
