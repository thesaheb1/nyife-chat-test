import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminPlans, useDeletePlan, useUpdatePlanStatus } from './useAdminPlans';
import { PlanFormDialog } from './PlanFormDialog';
import { formatCurrency } from '@/shared/utils/formatters';
import { toast } from 'sonner';

export function PlanListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useAdminPlans();
  const deletePlan = useDeletePlan();
  const updateStatus = useUpdatePlanStatus();
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const plans = data?.plans ?? [];

  const handleToggleStatus = async (id: string, current: boolean) => {
    try {
      await updateStatus.mutateAsync({ id, is_active: !current });
      toast.success('Plan status updated');
    } catch {
      toast.error('Failed to update plan status');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePlan.mutateAsync(deleteId);
      toast.success('Plan deleted');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete plan');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.plans.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/plans/coupons')}>
            <Tag className="mr-2 h-4 w-4" />
            {t('admin.coupons.title')}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('admin.plans.createPlan')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : !plans.length ? (
        <p className="text-muted-foreground">{t('admin.plans.noPlans')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>
                <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                  {plan.type}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {formatCurrency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.type === 'lifetime' ? 'once' : plan.type === 'yearly' ? 'yr' : 'mo'}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>{t('admin.plans.maxContacts')}</span>
                    <span className="font-medium">{plan.max_contacts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('admin.plans.maxTemplates')}</span>
                    <span className="font-medium">{plan.max_templates}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('admin.plans.maxCampaigns')}</span>
                    <span className="font-medium">{plan.max_campaigns_per_month}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('admin.plans.maxMessages')}</span>
                    <span className="font-medium">{plan.max_messages_per_month.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('admin.plans.maxTeamMembers')}</span>
                    <span className="font-medium">{plan.max_team_members}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={plan.is_active}
                      onCheckedChange={() => handleToggleStatus(plan.id, plan.is_active)}
                    />
                    <span className="text-sm">{plan.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditPlanId(plan.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(plan.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      {(showCreate || editPlanId) && (
        <PlanFormDialog
          planId={editPlanId ?? undefined}
          open={showCreate || !!editPlanId}
          onClose={() => { setShowCreate(false); setEditPlanId(null); }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
