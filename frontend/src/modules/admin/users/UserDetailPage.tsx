import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAdminUser,
  useUpdateUserStatus,
  useUserTransactions,
  useUserSubscriptions,
  useUserInvoices,
} from './useAdminUsers';
import { WalletActionDialog } from './WalletActionDialog';
import { formatCurrency } from '@/shared/utils/formatters';
import { toast } from 'sonner';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: user, isLoading } = useAdminUser(id);
  const updateStatus = useUpdateUserStatus();
  const { data: txData } = useUserTransactions(id);
  const { data: subData } = useUserSubscriptions(id);
  const { data: invData } = useUserInvoices(id);
  const [walletAction, setWalletAction] = useState<'credit' | 'debit' | null>(null);

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return <div className="text-muted-foreground">User not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
          {user.status}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('admin.users.walletBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(user.wallet_balance ?? 0)}</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setWalletAction('credit')}>
                {t('admin.users.creditWallet')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWalletAction('debit')}>
                {t('admin.users.debitWallet')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.current_plan ?? 'None'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {user.subscription_status ?? 'No subscription'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{user.role}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('admin.users.changeStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={user.status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">{t('admin.users.transactions')}</TabsTrigger>
          <TabsTrigger value="subscriptions">{t('admin.users.subscriptions')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('admin.users.invoices')}</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {!txData?.data?.transactions?.length ? (
                <p className="text-muted-foreground text-sm">No transactions found.</p>
              ) : (
                <div className="space-y-2">
                  {txData.data.transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="text-sm font-medium">{tx.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className={`font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {!subData?.subscriptions?.length ? (
                <p className="text-muted-foreground text-sm">No subscriptions found.</p>
              ) : (
                <div className="space-y-2">
                  {subData.subscriptions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="text-sm font-medium">{sub.plan?.name ?? sub.plan_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(sub.starts_at).toLocaleDateString()} — {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                        {sub.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {!invData?.invoices?.length ? (
                <p className="text-muted-foreground text-sm">No invoices found.</p>
              ) : (
                <div className="space-y-2">
                  {invData.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <div className="text-sm font-medium">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.type} — {new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(inv.total_amount)}</div>
                        <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Wallet Dialog */}
      {walletAction && id && (
        <WalletActionDialog
          userId={id}
          action={walletAction}
          open={!!walletAction}
          onClose={() => setWalletAction(null)}
        />
      )}
    </div>
  );
}
