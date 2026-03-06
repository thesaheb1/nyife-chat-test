import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAutomation, useCreateAutomation, useUpdateAutomation } from './useAutomations';
import { createAutomationSchema } from './validations';
import type { CreateAutomationFormData } from './validations';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiResponse } from '@/core/types';

export function CreateAutomationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: existing } = useAutomation(id);
  const createAuto = useCreateAutomation();
  const updateAuto = useUpdateAutomation();

  const [waAccounts, setWaAccounts] = useState<Array<{ id: string; display_phone: string; verified_name: string }>>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateAutomationFormData>({
    resolver: zodResolver(createAutomationSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'basic_reply',
      wa_account_id: '',
      trigger_config: '{\n  "trigger_type": "keyword",\n  "trigger_value": "hello"\n}',
      action_config: '{\n  "message_type": "text",\n  "content": {"body": "Hi! How can I help?"}\n}',
    },
  });

  useEffect(() => {
    apiClient.get<ApiResponse<{ accounts: Array<{ id: string; display_phone: string; verified_name: string }> }>>(ENDPOINTS.WHATSAPP.ACCOUNTS)
      .then((res) => setWaAccounts(res.data.data.accounts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (existing) {
      setValue('name', existing.name);
      setValue('description', existing.description || '');
      setValue('type', existing.type);
      setValue('wa_account_id', existing.wa_account_id);
      setValue('trigger_config', JSON.stringify(existing.trigger_config, null, 2));
      setValue('action_config', JSON.stringify(existing.action_config, null, 2));
    }
  }, [existing, setValue]);

  const onSubmit = async (data: CreateAutomationFormData) => {
    let trigger, action;
    try { trigger = JSON.parse(data.trigger_config); } catch { toast.error('Invalid trigger config JSON'); return; }
    try { action = JSON.parse(data.action_config); } catch { toast.error('Invalid action config JSON'); return; }

    const body = { name: data.name, description: data.description, type: data.type, wa_account_id: data.wa_account_id, trigger_config: trigger, action_config: action };
    try {
      if (isEdit) {
        await updateAuto.mutateAsync({ id, ...body });
        toast.success('Automation updated');
      } else {
        await createAuto.mutateAsync(body);
        toast.success('Automation created');
      }
      navigate('/automations');
    } catch (error) {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    }
  };

  const isPending = createAuto.isPending || updateAuto.isPending;
  const typeValue = watch('type');
  const waValue = watch('wa_account_id');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Automation' : 'Create Automation'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input {...register('name')} placeholder="Auto-reply welcome" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...register('description')} placeholder="Optional description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={typeValue} onValueChange={(v) => setValue('type', v as CreateAutomationFormData['type'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic_reply">Basic Reply</SelectItem>
                    <SelectItem value="advanced_flow">Advanced Flow</SelectItem>
                    <SelectItem value="webhook_trigger">Webhook Trigger</SelectItem>
                    <SelectItem value="api_trigger">API Trigger</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Account *</Label>
                <Select value={waValue} onValueChange={(v) => setValue('wa_account_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {waAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.verified_name || a.display_phone}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.wa_account_id && <p className="text-xs text-destructive">{errors.wa_account_id.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Trigger Config (JSON)</CardTitle></CardHeader>
          <CardContent>
            <Textarea {...register('trigger_config')} className="font-mono text-xs" rows={6} />
            {errors.trigger_config && <p className="text-xs text-destructive">{errors.trigger_config.message}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Action Config (JSON)</CardTitle></CardHeader>
          <CardContent>
            <Textarea {...register('action_config')} className="font-mono text-xs" rows={6} />
            {errors.action_config && <p className="text-xs text-destructive">{errors.action_config.message}</p>}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/automations')}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
