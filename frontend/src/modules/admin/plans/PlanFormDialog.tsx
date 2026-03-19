import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { paiseToRupees } from '@/shared/utils';
import { useAdminPlan, useCreatePlan, useUpdatePlan } from './useAdminPlans';
import { createPlanSchema, type CreatePlanFormData } from './validations';
import { toast } from 'sonner';
import { useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';

interface Props {
  planId?: string;
  open: boolean;
  onClose: () => void;
}

export function PlanFormDialog({ planId, open, onClose }: Props) {
  const { t } = useTranslation();
  const isEdit = !!planId;
  const { data: existingPlan } = useAdminPlan(planId);
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan(planId ?? '');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreatePlanFormData>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: {
      type: 'monthly',
      currency: 'INR',
      is_active: true,
      has_priority_support: false,
      sort_order: 0,
      price: 0,
      max_contacts: 100,
      max_templates: 10,
      max_campaigns_per_month: 5,
      max_messages_per_month: 1000,
      max_team_members: 1,
      max_organizations: 1,
      max_whatsapp_numbers: 1,
      marketing_message_price: 0,
      utility_message_price: 0,
      auth_message_price: 0,
    },
    mode: 'onChange',
  });
  const requiredFieldsFilled = useRequiredFieldsFilled(control, [
    'name',
    'slug',
    'type',
    'price',
    'max_contacts',
    'max_templates',
    'max_campaigns_per_month',
    'max_messages_per_month',
    'max_team_members',
    'max_organizations',
    'max_whatsapp_numbers',
    'marketing_message_price',
    'utility_message_price',
    'auth_message_price',
  ]);
  const isSubmitDisabled =
    isSubmitting || !requiredFieldsFilled || Object.keys(errors).length > 0;

  useEffect(() => {
    if (existingPlan && isEdit) {
      reset({
        name: existingPlan.name,
        slug: existingPlan.slug,
        description: existingPlan.description ?? '',
        type: existingPlan.type,
        price: paiseToRupees(existingPlan.price),
        currency: existingPlan.currency,
        max_contacts: existingPlan.max_contacts,
        max_templates: existingPlan.max_templates,
        max_campaigns_per_month: existingPlan.max_campaigns_per_month,
        max_messages_per_month: existingPlan.max_messages_per_month,
        max_team_members: existingPlan.max_team_members,
        max_organizations: existingPlan.max_organizations,
        max_whatsapp_numbers: existingPlan.max_whatsapp_numbers,
        has_priority_support: existingPlan.has_priority_support,
        marketing_message_price: paiseToRupees(existingPlan.marketing_message_price),
        utility_message_price: paiseToRupees(existingPlan.utility_message_price),
        auth_message_price: paiseToRupees(existingPlan.auth_message_price),
        sort_order: existingPlan.sort_order,
        is_active: existingPlan.is_active,
      });
    }
  }, [existingPlan, isEdit, reset]);

  const onSubmit = async (data: CreatePlanFormData) => {
    try {
      if (isEdit) {
        await updatePlan.mutateAsync(data as unknown as Record<string, unknown>);
        toast.success('Plan updated');
      } else {
        await createPlan.mutateAsync(data as unknown as Record<string, unknown>);
        toast.success('Plan created');
      }
      onClose();
    } catch {
      toast.error(isEdit ? 'Failed to update plan' : 'Failed to create plan');
    }
  };

  const numField = (
    name: keyof CreatePlanFormData,
    label: string,
    options: { min?: string; step?: string } = {}
  ) => (
    <div className="space-y-1">
      <Label className="text-xs" required>{label}</Label>
      <Input
        type="number"
        min={options.min ?? '1'}
        step={options.step ?? '1'}
        {...register(name, { valueAsNumber: true })}
        className="h-8"
      />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('admin.plans.editPlan') : t('admin.plans.createPlan')}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label required>{t('admin.plans.planName')}</Label>
                <Input {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label required>Slug</Label>
                <Input {...register('slug')} />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label required>{t('admin.plans.price')} (₹)</Label>
                <Input type="number" min="0" step="0.01" {...register('price', { valueAsNumber: true })} />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
              <div className="space-y-1">
                <Label required>{t('admin.plans.planType')}</Label>
                <Select
                  value={watch('type')}
                  onValueChange={(v) =>
                    setValue('type', v as 'monthly' | 'yearly' | 'lifetime', {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <h3 className="text-sm font-semibold pt-2">{t('admin.plans.limits')}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {numField('max_contacts', t('admin.plans.maxContacts'))}
              {numField('max_templates', t('admin.plans.maxTemplates'))}
              {numField('max_campaigns_per_month', t('admin.plans.maxCampaigns'))}
              {numField('max_messages_per_month', t('admin.plans.maxMessages'))}
              {numField('max_team_members', t('admin.plans.maxTeamMembers'))}
              {numField('max_organizations', 'Max organizations')}
              {numField('max_whatsapp_numbers', t('admin.plans.maxWhatsappNumbers'))}
            </div>

            <h3 className="text-sm font-semibold pt-2">Message Pricing (₹)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {numField('marketing_message_price', 'Marketing', { min: '0', step: '0.01' })}
              {numField('utility_message_price', 'Utility', { min: '0', step: '0.01' })}
              {numField('auth_message_price', 'Authentication', { min: '0', step: '0.01' })}
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(watch('has_priority_support'))}
                  onCheckedChange={(v) => setValue('has_priority_support', v)}
                />
                <Label className="text-sm">{t('admin.plans.prioritySupport')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(watch('is_active'))}
                  onCheckedChange={(v) => setValue('is_active', v)}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {isSubmitting ? 'Saving...' : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
