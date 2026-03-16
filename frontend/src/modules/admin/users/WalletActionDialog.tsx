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
import { Textarea } from '@/components/ui/textarea';
import { useCreditWallet, useDebitWallet } from './useAdminUsers';
import { walletActionSchema, type WalletActionFormData } from './validations';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/core/errors/apiError';

interface Props {
  userId: string;
  action: 'credit' | 'debit';
  open: boolean;
  onClose: () => void;
  organizationId?: string;
  organizationName?: string | null;
}

export function WalletActionDialog({
  userId,
  action,
  open,
  onClose,
  organizationId,
  organizationName,
}: Props) {
  const { t } = useTranslation();
  const creditMut = useCreditWallet();
  const debitMut = useDebitWallet();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WalletActionFormData>({
    resolver: zodResolver(walletActionSchema),
  });

  const onSubmit = async (data: WalletActionFormData) => {
    try {
      const mut = action === 'credit' ? creditMut : debitMut;
      await mut.mutateAsync({
        id: userId,
        amount: data.amount,
        remarks: data.remarks,
        organization_id: organizationId,
      });
      toast.success(`Wallet ${action}ed successfully`);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Failed to ${action} wallet.`));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action === 'credit' ? t('admin.users.creditWallet') : t('admin.users.debitWallet')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {organizationName ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Organization: <span className="font-medium text-foreground">{organizationName}</span>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="amount">{t('admin.users.amount')} (₹)</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">{t('admin.users.remarks')}</Label>
            <Textarea id="remarks" rows={3} {...register('remarks')} />
            {errors.remarks && (
              <p className="text-xs text-destructive">{errors.remarks.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : t('common.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
