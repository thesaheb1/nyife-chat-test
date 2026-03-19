import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ColumnDef } from '@tanstack/react-table';
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  TicketPercent,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/core/hooks/useDebounce';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useCan } from '@/core/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { formatCurrency } from '@/shared/utils/formatters';
import { paiseToRupees } from '@/shared/utils';
import type { Coupon } from '../types';
import {
  useAdminCoupons,
  useCreateCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
  useUpdateCouponStatus,
} from './useAdminPlans';
import { createCouponSchema, type CreateCouponFormData } from './validations';
import { useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';

const STATUS_VARIANTS: Record<
  Coupon['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  inactive: 'secondary',
  scheduled: 'outline',
  expired: 'destructive',
};

const EMPTY_FORM_VALUES: CreateCouponFormData = {
  code: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  max_uses: undefined,
  min_plan_price: undefined,
  valid_from: '',
  valid_until: '',
  is_active: true,
};

function toDateInputValue(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function toFormValues(coupon?: Coupon | null): CreateCouponFormData {
  if (!coupon) {
    return EMPTY_FORM_VALUES;
  }

  return {
    code: coupon.code,
    description: coupon.description || '',
    discount_type: coupon.discount_type,
    discount_value:
      coupon.discount_type === 'fixed'
        ? paiseToRupees(coupon.discount_value)
        : coupon.discount_value,
    max_uses: coupon.max_uses ?? undefined,
    min_plan_price:
      coupon.min_plan_price === null || coupon.min_plan_price === undefined
        ? undefined
        : paiseToRupees(coupon.min_plan_price),
    valid_from: toDateInputValue(coupon.valid_from),
    valid_until: toDateInputValue(coupon.valid_until),
    is_active: coupon.is_active,
  };
}

function buildCouponPayload(values: CreateCouponFormData) {
  return {
    code: values.code.trim().toUpperCase(),
    description: values.description?.trim() || undefined,
    discount_type: values.discount_type,
    discount_value: values.discount_value,
    max_uses: values.max_uses || undefined,
    min_plan_price: values.min_plan_price ?? undefined,
    valid_from: values.valid_from,
    valid_until: values.valid_until || undefined,
    is_active: values.is_active ?? true,
  };
}

function CouponFormDialog({
  coupon,
  open,
  onClose,
}: {
  coupon?: Coupon | null;
  open: boolean;
  onClose: () => void;
}) {
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon(coupon?.id ?? '');
  const isEditing = Boolean(coupon);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateCouponFormData>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: toFormValues(coupon),
    mode: 'onChange',
  });
  const requiredFieldsFilled = useRequiredFieldsFilled(control, [
    'code',
    'discount_type',
    'discount_value',
    'valid_from',
  ]);
  const isSubmitDisabled =
    isSubmitting || !requiredFieldsFilled || Object.keys(errors).length > 0;

  useEffect(() => {
    reset(toFormValues(coupon));
  }, [coupon, reset]);

  const onSubmit = async (values: CreateCouponFormData) => {
    try {
      const payload = buildCouponPayload(values);
      if (isEditing && coupon) {
        await updateCoupon.mutateAsync(payload);
        toast.success('Coupon updated.');
      } else {
        await createCoupon.mutateAsync(payload);
        toast.success('Coupon created.');
      }

      onClose();
      reset(EMPTY_FORM_VALUES);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, isEditing ? 'Failed to update coupon.' : 'Failed to create coupon.')
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-code" required>Coupon Code</Label>
              <Input
                id="coupon-code"
                {...register('code')}
                className="font-mono uppercase"
                placeholder="SAVE20"
              />
              {errors.code ? <p className="text-xs text-destructive">{errors.code.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-description">Description</Label>
              <Input
                id="coupon-description"
                {...register('description')}
                placeholder="Optional admin note"
              />
              {errors.description ? (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>Discount Type</Label>
              <Select
                value={watch('discount_type')}
                onValueChange={(value) =>
                  setValue('discount_type', value as 'percentage' | 'fixed', { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-discount-value" required>
                {watch('discount_type') === 'percentage' ? 'Discount Percentage' : 'Discount Amount (₹)'}
              </Label>
              <Input
                id="coupon-discount-value"
                type="number"
                min={watch('discount_type') === 'percentage' ? 1 : 0.01}
                step={watch('discount_type') === 'percentage' ? 1 : 0.01}
                {...register('discount_value', { valueAsNumber: true })}
              />
              {errors.discount_value ? (
                <p className="text-xs text-destructive">{errors.discount_value.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-max-uses">Max Uses</Label>
              <Input
                id="coupon-max-uses"
                type="number"
                min={1}
                placeholder="Leave empty for unlimited"
                {...register('max_uses', {
                  setValueAs: (value) => (value === '' ? null : Number(value)),
                })}
              />
              {errors.max_uses ? (
                <p className="text-xs text-destructive">{errors.max_uses.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-min-plan-price">Minimum Plan Price (₹)</Label>
              <Input
                id="coupon-min-plan-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="Optional"
                {...register('min_plan_price', {
                  setValueAs: (value) => (value === '' ? null : Number(value)),
                })}
              />
              {errors.min_plan_price ? (
                <p className="text-xs text-destructive">{errors.min_plan_price.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-valid-from" required>Valid From</Label>
              <Input id="coupon-valid-from" type="date" {...register('valid_from')} />
              {errors.valid_from ? (
                <p className="text-xs text-destructive">{errors.valid_from.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon-valid-until">Valid Until</Label>
              <Input id="coupon-valid-until" type="date" {...register('valid_until')} />
              {errors.valid_until ? (
                <p className="text-xs text-destructive">{errors.valid_until.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Coupon status</p>
              <p className="text-xs text-muted-foreground">
                Inactive coupons stay in history but cannot be applied at checkout.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(watch('is_active'))}
                onCheckedChange={(checked) =>
                  setValue('is_active', checked, { shouldDirty: true, shouldValidate: true })
                }
              />
              <span className="text-sm font-medium">{watch('is_active') ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Coupon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CouponsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Coupon['status']>('all');
  const [discountTypeFilter, setDiscountTypeFilter] = useState<'all' | Coupon['discount_type']>('all');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteCouponId, setDeleteCouponId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const canCreate = useCan('admin', 'plans', 'create');
  const canUpdate = useCan('admin', 'plans', 'update');
  const canDelete = useCan('admin', 'plans', 'delete');

  const couponsQuery = useAdminCoupons({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    discount_type: discountTypeFilter !== 'all' ? discountTypeFilter : undefined,
  });
  const updateStatus = useUpdateCouponStatus();
  const deleteCoupon = useDeleteCoupon();

  const coupons = couponsQuery.data?.data?.coupons ?? [];
  const meta = couponsQuery.data?.meta;

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      await updateStatus.mutateAsync({
        id: coupon.id,
        is_active: !coupon.is_active,
      });
      toast.success(`Coupon ${coupon.is_active ? 'deactivated' : 'activated'}.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update coupon status.'));
    }
  };

  const handleDeleteCoupon = async () => {
    if (!deleteCouponId) {
      return;
    }

    try {
      await deleteCoupon.mutateAsync(deleteCouponId);
      toast.success('Coupon deleted.');
      setDeleteCouponId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete coupon.'));
    }
  };

  const columns = useMemo<ColumnDef<Coupon>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Coupon',
        cell: ({ row }) => (
          <div>
            <div className="font-mono font-semibold">{row.original.code}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.description || 'No description'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'discount_value',
        header: 'Discount',
        cell: ({ row }) =>
          row.original.discount_type === 'percentage'
            ? `${row.original.discount_value}%`
            : formatCurrency(row.original.discount_value),
      },
      {
        accessorKey: 'used_count',
        header: 'Usage',
        cell: ({ row }) => `${row.original.used_count}/${row.original.max_uses ?? 'Unlimited'}`,
      },
      {
        accessorKey: 'valid_from',
        header: 'Validity',
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{new Date(row.original.valid_from).toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.valid_until
                ? `Until ${new Date(row.original.valid_until).toLocaleDateString()}`
                : 'No expiry'}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status]}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-row-click-ignore="true"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              data-row-click-ignore="true"
              onClick={(event) => event.stopPropagation()}
            >
              {canUpdate ? (
                <DropdownMenuItem onClick={() => setEditingCoupon(row.original)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Coupon
                </DropdownMenuItem>
              ) : null}
              {canUpdate ? (
                <DropdownMenuItem onClick={() => handleToggleStatus(row.original)}>
                  <TicketPercent className="mr-2 h-4 w-4" />
                  {row.original.is_active ? 'Deactivate' : 'Activate'}
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteCouponId(row.original.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Coupon
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canDelete, canUpdate, handleToggleStatus, updateStatus.isPending]
  );

  const filtersActive =
    search.trim().length > 0 ||
    statusFilter !== 'all' ||
    discountTypeFilter !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/plans')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Coupon Management</h1>
            <p className="text-sm text-muted-foreground">
              Search, filter, create, update, and retire coupons used in subscription checkout.
            </p>
          </div>
        </div>

        {canCreate ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Coupon
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
        <Input
          placeholder="Search by code or description"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-full xl:max-w-md"
        />

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as 'all' | Coupon['status']);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={discountTypeFilter}
          onValueChange={(value) => {
            setDiscountTypeFilter(value as 'all' | Coupon['discount_type']);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All discount types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All discount types</SelectItem>
            <SelectItem value="percentage">Percentage</SelectItem>
            <SelectItem value="fixed">Fixed amount</SelectItem>
          </SelectContent>
        </Select>

        {filtersActive ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setDiscountTypeFilter('all');
              setPage(1);
            }}
          >
            Reset Filters
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={coupons}
        isLoading={couponsQuery.isLoading}
        page={page}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total ?? coupons.length}
        onPageChange={setPage}
        emptyMessage="No coupons found."
      />

      {(showCreate || editingCoupon) ? (
        <CouponFormDialog
          coupon={editingCoupon}
          open={showCreate || Boolean(editingCoupon)}
          onClose={() => {
            setShowCreate(false);
            setEditingCoupon(null);
          }}
        />
      ) : null}

      <AlertDialog open={Boolean(deleteCouponId)} onOpenChange={() => setDeleteCouponId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              This retires the coupon from future checkout use but keeps historical subscription data intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCoupon}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
