import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CreditCard, Download, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/shared/components/DataTable';
import { formatCurrency } from '@/shared/utils/formatters';
import { loadRazorpayCheckout, unloadRazorpayCheckout } from '@/shared/utils/loadRazorpayCheckout';
import { isValidRupeeAmount } from '@/shared/utils';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { organizationQueryKey } from '@/core/queryKeys';
import type { RootState } from '@/core/store';
import type { Wallet, Transaction, Invoice, ApiResponse, PaginationMeta } from '@/core/types';
import { useOrganizationContext } from '@/modules/organizations/useOrganizationContext';

function useWalletBalance(userId?: string | null, organizationId?: string | null) {
  return useQuery<Wallet>({
    queryKey: organizationQueryKey(['wallet'] as const, userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Wallet>>(ENDPOINTS.WALLET.BASE);
      return data.data;
    },
    enabled: Boolean(userId && organizationId),
  });
}

function useTransactions(
  params: { page?: number; type?: string; source?: string },
  userId?: string | null,
  organizationId?: string | null
) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  q.set('limit', '20');
  if (params.type) q.set('type', params.type);
  if (params.source) q.set('source', params.source);
  return useQuery<{ data: Transaction[]; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['transactions', params] as const, userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Transaction[]>>(`${ENDPOINTS.WALLET.TRANSACTIONS}?${q}`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && organizationId),
  });
}

function useInvoices(page = 1, userId?: string | null, organizationId?: string | null) {
  return useQuery<{ data: Invoice[]; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['invoices', page] as const, userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Invoice[]>>(`${ENDPOINTS.WALLET.INVOICES}?page=${page}&limit=20`);
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && organizationId),
  });
}

export function WalletPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { activeOrganization } = useOrganizationContext();
  const organizationId = activeOrganization?.id;
  const { data: wallet } = useWalletBalance(userId, organizationId);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState('');
  const [invPage, setInvPage] = useState(1);

  const { data: txData, isLoading: txLoading } = useTransactions(
    { page: txPage, type: txType || undefined },
    userId,
    organizationId
  );
  const { data: invData, isLoading: invLoading } = useInvoices(invPage, userId, organizationId);

  const transactions = txData?.data ?? [];
  const txMeta = txData?.meta;
  const invoices = invData?.data ?? [];
  const invMeta = invData?.meta;
  const rechargeAmount = Number(amount);
  const isRechargeAmountValid =
    amount.trim().length > 0 &&
    Number.isFinite(rechargeAmount) &&
    isValidRupeeAmount(rechargeAmount, { allowZero: false }) &&
    rechargeAmount >= 100;

  const initiateRecharge = useMutation({
    mutationFn: async () => {
      if (!isRechargeAmountValid) throw new Error('Enter a valid amount of at least ₹100');
      const { data } = await apiClient.post<ApiResponse<{ order_id: string; amount: number; currency: string }>>(
        ENDPOINTS.WALLET.RECHARGE,
        { amount: rechargeAmount }
      );
      return data.data;
    },
    onSuccess: async (order) => {
      setRechargeOpen(false);
      try {
        const Razorpay = await loadRazorpayCheckout();
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency,
          name: 'Nyife',
          description: 'Wallet Recharge',
          order_id: order.order_id,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await apiClient.post(ENDPOINTS.WALLET.VERIFY_RECHARGE, response);
              unloadRazorpayCheckout();
              toast.success('Wallet recharged successfully!');
              qc.invalidateQueries({ queryKey: ['wallet'] });
              qc.invalidateQueries({ queryKey: ['transactions'] });
            } catch {
              unloadRazorpayCheckout();
              toast.error('Payment verification failed');
            }
          },
          modal: {
            ondismiss: () => {
              unloadRazorpayCheckout();
            },
          },
          theme: { color: '#16a34a' },
        };
        const rzp = new Razorpay(options);
        rzp.open();
      } catch (error) {
        unloadRazorpayCheckout();
        toast.error(error instanceof Error ? error.message : 'Razorpay checkout is unavailable right now.');
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to initiate recharge'),
  });

  const txColumns = useMemo<ColumnDef<Transaction, unknown>[]>(() => [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => {
        const t = getValue() as string;
        return <Badge variant="secondary" className={`text-xs ${t === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t}</Badge>;
      },
    },
    { accessorKey: 'amount', header: 'Amount', cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatCurrency(getValue() as number)}</span> },
    { accessorKey: 'source', header: 'Source', cell: ({ getValue }) => <span className="text-xs capitalize">{(getValue() as string).replace('_', ' ')}</span> },
    { accessorKey: 'description', header: 'Description', cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span> },
    { accessorKey: 'balance_after', header: 'Balance After', cell: ({ getValue }) => <span className="tabular-nums text-xs">{formatCurrency(getValue() as number)}</span> },
    { accessorKey: 'created_at', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
  ], []);

  const invColumns = useMemo<ColumnDef<Invoice, unknown>[]>(() => [
    { accessorKey: 'invoice_number', header: 'Invoice #', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: 'type', header: 'Type', cell: ({ getValue }) => <Badge variant="outline" className="text-xs capitalize">{(getValue() as string).replace('_', ' ')}</Badge> },
    { accessorKey: 'total_amount', header: 'Amount', cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatCurrency(getValue() as number)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => { const s = getValue() as string; return <Badge variant="secondary" className={`text-xs ${s === 'paid' ? 'bg-green-100 text-green-700' : ''}`}>{s}</Badge>; } },
    { accessorKey: 'created_at', header: 'Date', cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
    {
      id: 'download',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`${ENDPOINTS.WALLET.INVOICES}/${row.original.id}/download`, '_blank')}>
          <Download className="h-3 w-3" />
        </Button>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Card className="flex-1">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-sm text-muted-foreground">{t('wallet.balance')}</p>
              <p className="text-3xl font-bold tabular-nums">{wallet ? formatCurrency(wallet.balance) : '—'}</p>
            </div>
            <Button onClick={() => setRechargeOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />Recharge
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-3">
          <Select value={txType} onValueChange={(v) => { setTxType(v === 'all' ? '' : v); setTxPage(1); }}>
            <SelectTrigger className="h-9 w-32"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="credit">Credits</SelectItem>
              <SelectItem value="debit">Debits</SelectItem>
            </SelectContent>
          </Select>
          <DataTable columns={txColumns} data={transactions} isLoading={txLoading} page={txMeta?.page ?? 1} totalPages={txMeta?.totalPages ?? 1} total={txMeta?.total} onPageChange={setTxPage} emptyMessage="No transactions yet." />
        </TabsContent>

        <TabsContent value="invoices">
          <DataTable columns={invColumns} data={invoices} isLoading={invLoading} page={invMeta?.page ?? 1} totalPages={invMeta?.totalPages ?? 1} total={invMeta?.total} onPageChange={setInvPage} emptyMessage="No invoices yet." />
        </TabsContent>
      </Tabs>

      {/* Recharge Dialog */}
      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recharge Wallet</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              min="100"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Min ₹100"
            />
          </div>
          <div className="flex gap-2">
            {[500, 1000, 2000, 5000].map((v) => (
              <Button key={v} variant="outline" size="sm" onClick={() => setAmount(String(v))}>₹{v}</Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechargeOpen(false)}>Cancel</Button>
            <Button onClick={() => initiateRecharge.mutate()} disabled={initiateRecharge.isPending || !isRechargeAmountValid}>
              {initiateRecharge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Pay ₹{amount || 0}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
