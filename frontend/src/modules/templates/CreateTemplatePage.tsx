import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useTemplate, useCreateTemplate, useUpdateTemplate } from './useTemplates';
import { createTemplateSchema } from './validations';
import type { CreateTemplateFormData } from './validations';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { useFlows } from '@/modules/flows/useFlows';

interface ComponentField {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  buttons?: ButtonField[];
}

interface ButtonField {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'OTP' | 'FLOW' | 'CATALOG' | 'MPM' | 'COPY_CODE';
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string;
  flow_id?: string;
  flow_name?: string;
  flow_action?: string;
  flow_json?: string;
  navigate_screen?: string;
  otp_type?: 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';
  autofill_text?: string;
  package_name?: string;
  signature_hash?: string;
}

export function CreateTemplatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing } = useTemplate(id);
  const { data: waAccounts } = useWhatsAppAccounts();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [components, setComponents] = useState<ComponentField[]>(() => {
    if (existing?.components) {
      return existing.components as ComponentField[];
    }
    return [{ type: 'BODY', text: '' }];
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          display_name: existing.display_name || '',
          language: existing.language,
          category: existing.category,
          type: existing.type,
          components: existing.components as CreateTemplateFormData['components'],
          waba_id: existing.waba_id || '',
        }
      : {
          language: 'en_US',
          category: 'MARKETING',
          type: 'standard',
          components: [{ type: 'BODY', text: '' }],
        },
  });

  useEffect(() => {
    if (!existing) {
      return;
    }

    const existingComponents = (existing.components as ComponentField[]) || [{ type: 'BODY', text: '' }];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setComponents(existingComponents);
    reset({
      name: existing.name,
      display_name: existing.display_name || '',
      language: existing.language,
      category: existing.category,
      type: existing.type,
      components: existing.components as CreateTemplateFormData['components'],
      waba_id: existing.waba_id || '',
    });
  }, [existing, reset]);

  // Sync components state to form
  const syncComponents = (updated: ComponentField[]) => {
    setComponents(updated);
    setValue('components', updated as CreateTemplateFormData['components'], { shouldValidate: true });
  };

  const addComponent = (type: ComponentField['type']) => {
    const exists = components.some((c) => c.type === type);
    if (exists && type !== 'BUTTONS') {
      toast.error(`${type} component already exists`);
      return;
    }
    const comp: ComponentField = { type };
    if (type === 'HEADER') comp.format = 'TEXT';
    if (type === 'BODY' || type === 'HEADER' || type === 'FOOTER') comp.text = '';
    if (type === 'BUTTONS') comp.buttons = [{ type: 'QUICK_REPLY', text: '' }];
    syncComponents([...components, comp]);
  };

  const removeComponent = (index: number) => {
    syncComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (index: number, updates: Partial<ComponentField>) => {
    const updated = [...components];
    updated[index] = { ...updated[index], ...updates };
    syncComponents(updated);
  };

  const addButton = (compIndex: number) => {
    const updated = [...components];
    const comp = { ...updated[compIndex] };
    comp.buttons = [...(comp.buttons || []), { type: 'QUICK_REPLY' as const, text: '' }];
    updated[compIndex] = comp;
    syncComponents(updated);
  };

  const removeButton = (compIndex: number, btnIndex: number) => {
    const updated = [...components];
    const comp = { ...updated[compIndex] };
    comp.buttons = (comp.buttons || []).filter((_, i) => i !== btnIndex);
    updated[compIndex] = comp;
    syncComponents(updated);
  };

  const updateButton = (compIndex: number, btnIndex: number, updates: Partial<ButtonField>) => {
    const updated = [...components];
    const comp = { ...updated[compIndex] };
    const buttons = [...(comp.buttons || [])];
    buttons[btnIndex] = { ...buttons[btnIndex], ...updates };
    comp.buttons = buttons;
    updated[compIndex] = comp;
    syncComponents(updated);
  };

  const sanitizeButton = (button: ButtonField): ButtonField => {
    const cleaned: ButtonField = { type: button.type };

    const assign = <T extends keyof ButtonField>(key: T, value: ButtonField[T]) => {
      if (value !== undefined && value !== null && value !== '') {
        cleaned[key] = value;
      }
    };

    assign('text', button.text?.trim());
    assign('url', button.url?.trim());
    assign('phone_number', button.phone_number?.trim());
    assign('example', button.example?.trim());
    assign('flow_id', button.flow_id?.trim());
    assign('flow_name', button.flow_name?.trim());
    assign('flow_action', button.flow_action?.trim());
    assign('flow_json', button.flow_json?.trim());
    assign('navigate_screen', button.navigate_screen?.trim());
    assign('otp_type', button.otp_type);
    assign('autofill_text', button.autofill_text?.trim());
    assign('package_name', button.package_name?.trim());
    assign('signature_hash', button.signature_hash?.trim());

    return cleaned;
  };

  const sanitizedComponents = components.map((component) => ({
    ...component,
    text: component.text?.trim() || undefined,
    buttons: component.buttons?.map(sanitizeButton),
  }));
  const categoryValue = useWatch({ control, name: 'category' });
  const typeValue = useWatch({ control, name: 'type' });
  const wabaValue = useWatch({ control, name: 'waba_id' });
  const { data: flowsData } = useFlows({
    limit: 100,
    waba_id: wabaValue || undefined,
  });
  const flows = flowsData?.flows || [];

  const wabaOptions = Array.from(
    new Map(
      (waAccounts || []).map((account) => [
        account.waba_id,
        {
          value: account.waba_id,
          label: `${account.verified_name || account.display_phone || account.waba_id} (${account.waba_id})`,
        },
      ])
    ).values()
  );

  const onSubmit = async (data: CreateTemplateFormData) => {
    try {
      const payload = {
        ...data,
        display_name: data.display_name || undefined,
        waba_id: data.waba_id || undefined,
        components: sanitizedComponents as CreateTemplateFormData['components'],
      };
      if (isEdit) {
        await updateTemplate.mutateAsync({ id, ...payload });
        toast.success('Template updated');
      } else {
        await createTemplate.mutateAsync(payload);
        toast.success('Template created');
      }
      navigate('/templates');
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Operation failed';
      toast.error(msg);
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? 'Edit Template' : 'Create Template'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  {...register('name')}
                  placeholder="e.g., order_confirmation"
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  {...register('display_name')}
                  placeholder="e.g., Order Confirmation"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={categoryValue}
                  onValueChange={(v) => setValue('category', v as CreateTemplateFormData['category'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={typeValue}
                  onValueChange={(v) => setValue('type', v as CreateTemplateFormData['type'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="authentication">Authentication</SelectItem>
                    <SelectItem value="carousel">Carousel</SelectItem>
                    <SelectItem value="flow">Flow</SelectItem>
                    <SelectItem value="list_menu">List Menu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Input {...register('language')} placeholder="en_US" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>WABA ID</Label>
              {wabaOptions.length > 0 && (
                <Select
                  value={wabaValue || 'manual'}
                  onValueChange={(value) => setValue('waba_id', value === 'manual' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual entry</SelectItem>
                    {wabaOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                {...register('waba_id')}
                placeholder="WhatsApp Business Account ID (optional)"
              />
              {wabaOptions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Pick a connected WABA or keep a manual override for a different business account.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Components Builder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Components</CardTitle>
              <div className="flex gap-2">
                {!components.some((c) => c.type === 'HEADER') && (
                  <Button type="button" variant="outline" size="sm" onClick={() => addComponent('HEADER')}>
                    + Header
                  </Button>
                )}
                {!components.some((c) => c.type === 'BODY') && (
                  <Button type="button" variant="outline" size="sm" onClick={() => addComponent('BODY')}>
                    + Body
                  </Button>
                )}
                {!components.some((c) => c.type === 'FOOTER') && (
                  <Button type="button" variant="outline" size="sm" onClick={() => addComponent('FOOTER')}>
                    + Footer
                  </Button>
                )}
                {!components.some((c) => c.type === 'BUTTONS') && (
                  <Button type="button" variant="outline" size="sm" onClick={() => addComponent('BUTTONS')}>
                    + Buttons
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {components.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add at least one component (Body is required).
              </p>
            )}
            {errors.components && (
              <p className="text-sm text-destructive">
                {typeof errors.components.message === 'string' ? errors.components.message : 'Invalid components'}
              </p>
            )}

            {components.map((comp, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{comp.type}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeComponent(idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* HEADER component */}
                {comp.type === 'HEADER' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Format</Label>
                      <Select
                        value={comp.format || 'TEXT'}
                        onValueChange={(v) => updateComponent(idx, { format: v as ComponentField['format'] })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TEXT">Text</SelectItem>
                          <SelectItem value="IMAGE">Image</SelectItem>
                          <SelectItem value="VIDEO">Video</SelectItem>
                          <SelectItem value="DOCUMENT">Document</SelectItem>
                          <SelectItem value="LOCATION">Location</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {comp.format === 'TEXT' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Header Text</Label>
                        <Input
                          value={comp.text || ''}
                          onChange={(e) => updateComponent(idx, { text: e.target.value })}
                          placeholder="Header text (use {{1}} for variables)"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* BODY component */}
                {comp.type === 'BODY' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Body Text</Label>
                    <Textarea
                      value={comp.text || ''}
                      onChange={(e) => updateComponent(idx, { text: e.target.value })}
                      placeholder="Message body (use {{1}}, {{2}} for variables)"
                      rows={4}
                    />
                  </div>
                )}

                {/* FOOTER component */}
                {comp.type === 'FOOTER' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Footer Text</Label>
                    <Input
                      value={comp.text || ''}
                      onChange={(e) => updateComponent(idx, { text: e.target.value })}
                      placeholder="Footer text (e.g., Reply STOP to unsubscribe)"
                    />
                  </div>
                )}

                {/* BUTTONS component */}
                {comp.type === 'BUTTONS' && (
                  <div className="space-y-3">
                    {(comp.buttons || []).map((btn, btnIdx) => (
                      <div key={btnIdx} className="rounded border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">Button {btnIdx + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeButton(idx, btnIdx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select
                              value={btn.type}
                              onValueChange={(v) => updateButton(idx, btnIdx, { type: v as ButtonField['type'] })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                                <SelectItem value="URL">URL</SelectItem>
                                <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                                <SelectItem value="COPY_CODE">Copy Code</SelectItem>
                                <SelectItem value="OTP">OTP</SelectItem>
                                <SelectItem value="FLOW">Flow</SelectItem>
                                <SelectItem value="CATALOG">Catalog</SelectItem>
                                <SelectItem value="MPM">Multi Product</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Text</Label>
                            <Input
                              value={btn.text || ''}
                              onChange={(e) => updateButton(idx, btnIdx, { text: e.target.value })}
                              placeholder="Button text"
                              className="h-8"
                            />
                          </div>
                        </div>
                        {(btn.type === 'COPY_CODE' || btn.type === 'CATALOG' || btn.type === 'MPM') && (
                          <div className="space-y-1">
                            <Label className="text-xs">Example / Code</Label>
                            <Input
                              value={btn.example || ''}
                              onChange={(e) => updateButton(idx, btnIdx, { example: e.target.value })}
                              placeholder={btn.type === 'COPY_CODE' ? 'SAVE20' : 'Optional example'}
                              className="h-8"
                            />
                          </div>
                        )}
                        {btn.type === 'URL' && (
                          <div className="space-y-1">
                            <Label className="text-xs">URL</Label>
                            <Input
                              value={btn.url || ''}
                              onChange={(e) => updateButton(idx, btnIdx, { url: e.target.value })}
                              placeholder="https://example.com/{{1}}"
                              className="h-8"
                            />
                          </div>
                        )}
                        {btn.type === 'PHONE_NUMBER' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Phone Number</Label>
                            <Input
                              value={btn.phone_number || ''}
                              onChange={(e) => updateButton(idx, btnIdx, { phone_number: e.target.value })}
                              placeholder="+1234567890"
                              className="h-8"
                            />
                          </div>
                        )}
                        {btn.type === 'FLOW' && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Flow</Label>
                              <Select
                                value={btn.flow_id || 'manual'}
                                onValueChange={(value) => {
                                  if (value === 'manual') {
                                    updateButton(idx, btnIdx, { flow_id: '', flow_name: '' });
                                    return;
                                  }

                                  const selectedFlow = flows.find((flow) => flow.id === value);
                                  updateButton(idx, btnIdx, {
                                    flow_id: value,
                                    flow_name: selectedFlow?.name || btn.flow_name || '',
                                    flow_action: btn.flow_action || 'navigate',
                                    navigate_screen: btn.navigate_screen || selectedFlow?.json_definition?.screens?.[0]?.id || '',
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">Manual entry</SelectItem>
                                  {flows.map((flow) => (
                                    <SelectItem key={flow.id} value={flow.id}>
                                      {flow.name} ({flow.status})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Flow ID / override</Label>
                              <Input
                                value={btn.flow_id || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { flow_id: e.target.value })}
                                placeholder="Local flow ID or Meta flow ID"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Flow Name</Label>
                              <Input
                                value={btn.flow_name || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { flow_name: e.target.value })}
                                placeholder="Lead intake"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Flow Action</Label>
                              <Input
                                value={btn.flow_action || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { flow_action: e.target.value })}
                                placeholder="navigate"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Navigate Screen</Label>
                              {btn.flow_id && flows.find((flow) => flow.id === btn.flow_id) ? (
                                <Select
                                  value={btn.navigate_screen || 'first'}
                                  onValueChange={(value) => updateButton(idx, btnIdx, { navigate_screen: value === 'first' ? '' : value })}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="first">First screen</SelectItem>
                                    {(flows.find((flow) => flow.id === btn.flow_id)?.json_definition.screens || []).map((screen) => (
                                      <SelectItem key={screen.id} value={screen.id}>
                                        {screen.title} ({screen.id})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={btn.navigate_screen || ''}
                                  onChange={(e) => updateButton(idx, btnIdx, { navigate_screen: e.target.value })}
                                  placeholder="APPOINTMENT_FORM"
                                  className="h-8"
                                />
                              )}
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs">Flow JSON</Label>
                              <Textarea
                                value={btn.flow_json || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { flow_json: e.target.value })}
                                placeholder='{"prefill":{"source":"campaign"}}'
                                rows={4}
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                        )}
                        {btn.type === 'OTP' && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">OTP Type</Label>
                              <Select
                                value={btn.otp_type || 'COPY_CODE'}
                                onValueChange={(value) => updateButton(idx, btnIdx, { otp_type: value as ButtonField['otp_type'] })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="COPY_CODE">Copy Code</SelectItem>
                                  <SelectItem value="ONE_TAP">One Tap</SelectItem>
                                  <SelectItem value="ZERO_TAP">Zero Tap</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Autofill Text</Label>
                              <Input
                                value={btn.autofill_text || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { autofill_text: e.target.value })}
                                placeholder="Tap to verify"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Package Name</Label>
                              <Input
                                value={btn.package_name || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { package_name: e.target.value })}
                                placeholder="com.example.app"
                                className="h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Signature Hash</Label>
                              <Input
                                value={btn.signature_hash || ''}
                                onChange={(e) => updateButton(idx, btnIdx, { signature_hash: e.target.value })}
                                placeholder="App hash"
                                className="h-8"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {(comp.buttons || []).length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addButton(idx)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add Button
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto max-w-sm rounded-lg bg-green-50 p-4 dark:bg-green-950/30">
              {components.map((comp, idx) => (
                <div key={idx}>
                  {comp.type === 'HEADER' && comp.format === 'TEXT' && comp.text && (
                    <p className="mb-1 font-bold text-sm">{comp.text}</p>
                  )}
                  {comp.type === 'HEADER' && comp.format && comp.format !== 'TEXT' && (
                    <div className="mb-2 rounded bg-gray-200 dark:bg-gray-700 p-6 text-center text-xs text-muted-foreground">
                      [{comp.format}]
                    </div>
                  )}
                  {comp.type === 'BODY' && comp.text && (
                    <p className="text-sm whitespace-pre-wrap">{comp.text}</p>
                  )}
                  {comp.type === 'FOOTER' && comp.text && (
                    <p className="mt-2 text-xs text-muted-foreground">{comp.text}</p>
                  )}
                  {comp.type === 'BUTTONS' && comp.buttons && comp.buttons.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <Separator />
                      {comp.buttons.map((btn, btnIdx) => (
                        <div
                          key={btnIdx}
                          className="rounded bg-white dark:bg-gray-800 py-1.5 text-center text-sm font-medium text-blue-600 dark:text-blue-400"
                        >
                          {(btn.text || btn.flow_name || btn.example || `Button ${btnIdx + 1}`)} <span className="text-[10px] uppercase text-muted-foreground">({btn.type})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {components.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  Add components to see a preview
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/templates')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </form>
    </div>
  );
}
