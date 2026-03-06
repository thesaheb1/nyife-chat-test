import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
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

interface ComponentField {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
  text?: string;
  buttons?: ButtonField[];
}

interface ButtonField {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export function CreateTemplatePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { data: existing } = useTemplate(id);
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
    watch,
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

  const onSubmit = async (data: CreateTemplateFormData) => {
    try {
      if (isEdit) {
        await updateTemplate.mutateAsync({ id, ...data });
        toast.success('Template updated');
      } else {
        await createTemplate.mutateAsync(data);
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
                  value={watch('category')}
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
                  value={watch('type')}
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
              <Input
                {...register('waba_id')}
                placeholder="WhatsApp Business Account ID (optional)"
              />
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
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Text</Label>
                            <Input
                              value={btn.text}
                              onChange={(e) => updateButton(idx, btnIdx, { text: e.target.value })}
                              placeholder="Button text"
                              className="h-8"
                            />
                          </div>
                        </div>
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
                      </div>
                    ))}
                    {(comp.buttons || []).length < 3 && (
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
                          {btn.text || `Button ${btnIdx + 1}`}
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
