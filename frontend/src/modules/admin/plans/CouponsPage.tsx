import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ArrowLeft, Trash2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { DataTable } from '@/shared/components/DataTable';
import { useAdminCoupons, useCreateCoupon, useDeleteCoupon } from './useAdminPlans';
import { createCouponSchema, type CreateCouponFormData } from './validations';
import type { Coupon } from '../types';
import { toast } from 'sonner';

const columns: ColumnDef<Coupon>[] = [
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => <span className="font-mono font-semibold">{row.original.code}</span>,
  },
  {
    accessorKey: 'discount_type',
    header: 'Discount',
    cell: ({ row }) => (
      <span>
        {row.original.discount_value}
        {row.original.discount_type === 'percentage' ? '%' : ' INR'}
      </span>
    ),
  },
  {
    accessorKey: 'uses_count',
    header: 'Uses',
    cell: ({ row }) => `${row.original.uses_count}/${row.original.max_uses ?? '∞'}`,
  },
  {
    accessorKey: 'valid_from',
    header: 'Valid From',
    cell: ({ row }) => new Date(row.original.valid_from).toLocaleDateString(),
  },
  {
    accessorKey: 'valid_until',
    header: 'Valid Until',
    cell: ({ row }) =>
      row.original.valid_until ? new Date(row.original.valid_until).toLocaleDateString() : 'N/A',
  },
  {
    accessorKey: 'is_active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
        {row.original.is_active ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

export function CouponsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: coupons = [], isLoading } = useAdminCoupons();
  const createCoupon = useCreateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCouponFormData>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: { discount_type: 'percentage', is_active: true },
  });

  const onSubmit = async (data: CreateCouponFormData) => {
    try {
      await createCoupon.mutateAsync(data as unknown as Record<string, unknown>);
      toast.success('Coupon created');
      setShowCreate(false);
      reset();
    } catch {
      toast.error('Failed to create coupon');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCoupon.mutateAsync(deleteId);
      toast.success('Coupon deleted');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const columnsWithActions: ColumnDef<Coupon>[] = [
    ...columns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => setDeleteId(row.original.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/plans')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{t('admin.coupons.title')}</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('admin.coupons.createCoupon')}
        </Button>
      </div>

      <DataTable
        columns={columnsWithActions}
        data={coupons}
        isLoading={isLoading}
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.coupons.createCoupon')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.coupons.code')}</Label>
              <Input {...register('code')} className="font-mono uppercase" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.coupons.discountType')}</Label>
                <Select value={watch('discount_type')} onValueChange={(v) => setValue('discount_type', v as 'percentage' | 'fixed')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t('admin.coupons.percentage')}</SelectItem>
                    <SelectItem value="fixed">{t('admin.coupons.fixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.coupons.discountValue')}</Label>
                <Input type="number" {...register('discount_value', { valueAsNumber: true })} />
                {errors.discount_value && <p className="text-xs text-destructive">{errors.discount_value.message}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.coupons.validFrom')}</Label>
                <Input type="date" {...register('valid_from')} />
                {errors.valid_from && <p className="text-xs text-destructive">{errors.valid_from.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{t('admin.coupons.validUntil')}</Label>
                <Input type="date" {...register('valid_until')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.coupons.maxUses')}</Label>
                <Input type="number" {...register('max_uses', { valueAsNumber: true })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={Boolean(watch('is_active'))} onCheckedChange={(v) => setValue('is_active', v)} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>Are you sure?</AlertDialogDescription>
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
