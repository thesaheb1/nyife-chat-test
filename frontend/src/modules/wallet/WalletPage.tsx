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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/shared/components/DataTable';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingToolbar,
} from '@/shared/components';
import { useListingState } from '@/shared/hooks/useListingState';
import { formatCurrency } from '@/shared/utils/formatters';
import { loadRazorpayCheckout, unloadRazorpayCheckout } from '@/shared/utils/loadRazorpayCheckout';
import { buildListQuery, isValidRupeeAmount } from '@/shared/utils';
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
  params: { page?: number; limit?: number; search?: string; type?: string; source?: string; date_from?: string; date_to?: string },
  userId?: string | null,
  organizationId?: string | null
) {
  return useQuery<{ data: Transaction[]; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['transactions', params] as const, userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Transaction[]>>(
        `${ENDPOINTS.WALLET.TRANSACTIONS}${buildListQuery({
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          search: params.search,
          type: params.type,
          source: params.source,
          date_from: params.date_from,
          date_to: params.date_to,
        })}`
      );
      return { data: data.data, meta: data.meta! };
    },
    enabled: Boolean(userId && organizationId),
  });
}

function useInvoices(
  params: { page?: number; limit?: number; search?: string; status?: Invoice['status']; date_from?: string; date_to?: string } = {},
  userId?: string | null,
  organizationId?: string | null
) {
  return useQuery<{ data: Invoice[]; meta: PaginationMeta }>({
    queryKey: organizationQueryKey(['invoices', params] as const, userId, organizationId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Invoice[]>>(
        `${ENDPOINTS.WALLET.INVOICES}${buildListQuery({
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          search: params.search,
          status: params.status,
          date_from: params.date_from,
          date_to: params.date_to,
        })}`
      );
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
  const transactionListing = useListingState({
    initialFilters: {
      type: '',
      source: '',
    },
    syncToUrl: true,
    namespace: 'transactions',
  });
  const invoiceListing = useListingState({
    initialFilters: {
      status: '',
    },
    syncToUrl: true,
    namespace: 'invoices',
  });
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'transactions' | 'invoices'>('transactions');

  const { data: txData, isLoading: txLoading } = useTransactions(
    {
      page: transactionListing.page,
      limit: 20,
      search: transactionListing.debouncedSearch || undefined,
      type: transactionListing.filters.type || undefined,
      source: transactionListing.filters.source || undefined,
      date_from: transactionListing.dateRange.from,
      date_to: transactionListing.dateRange.to,
    },
    userId,
    organizationId
  );
  const { data: invData, isLoading: invLoading } = useInvoices(
    {
      page: invoiceListing.page,
      limit: 20,
      search: invoiceListing.debouncedSearch || undefined,
      status: (invoiceListing.filters.status || undefined) as Invoice['status'] | undefined,
      date_from: invoiceListing.dateRange.from,
      date_to: invoiceListing.dateRange.to,
    },
    userId,
    organizationId
  );

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
      <ListingPageHeader
        title={t('wallet.balance')}
        description="Review wallet balance, transactions, and invoices from a unified ledger view."
      />

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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'transactions' | 'invoices')}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">

          <ListingTableCard>
            <ListingToolbar
              searchValue={transactionListing.search}
              onSearchChange={transactionListing.setSearch}
              searchPlaceholder="Search transactions..."
              filters={[
                {
                  id: 'type',
                  value: transactionListing.filters.type,
                  placeholder: 'Type',
                  onChange: (value) => transactionListing.setFilter('type', value),
                  allLabel: 'All types',
                  options: [
                    { value: 'credit', label: 'Credit' },
                    { value: 'debit', label: 'Debit' },
                  ],
                },
                {
                  id: 'source',
                  value: transactionListing.filters.source,
                  placeholder: 'Source',
                  onChange: (value) => transactionListing.setFilter('source', value),
                  allLabel: 'All sources',
                  options: [
                    { value: 'recharge', label: 'Recharge' },
                    { value: 'message_debit', label: 'Message debit' },
                    { value: 'admin_credit', label: 'Admin credit' },
                    { value: 'admin_debit', label: 'Admin debit' },
                    { value: 'refund', label: 'Refund' },
                    { value: 'subscription_payment', label: 'Subscription payment' },
                  ],
                },
              ]}
              dateRange={transactionListing.dateRange}
              onDateRangeChange={transactionListing.setDateRange}
              dateRangePlaceholder="Transaction date range"
              hasActiveFilters={transactionListing.hasActiveFilters}
              onReset={transactionListing.resetAll}
            />
            <DataTable
              columns={txColumns}
              data={transactions}
              isLoading={txLoading}
              page={txMeta?.page ?? 1}
              totalPages={txMeta?.totalPages ?? 1}
              total={txMeta?.total}
              onPageChange={transactionListing.setPage}
              emptyMessage={(
                <ListingEmptyState
                  title="No transactions found"
                  description="Adjust the current filters or recharge the wallet to create new ledger activity."
                />
              )}
            />
          </ListingTableCard>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">

          <ListingTableCard>
            <ListingToolbar
              searchValue={invoiceListing.search}
              onSearchChange={invoiceListing.setSearch}
              searchPlaceholder="Search invoices..."
              filters={[
                {
                  id: 'status',
                  value: invoiceListing.filters.status,
                  placeholder: 'Status',
                  onChange: (value) => invoiceListing.setFilter('status', value),
                  allLabel: 'All statuses',
                  options: [
                    { value: 'paid', label: 'Paid' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ],
                },
              ]}
              dateRange={invoiceListing.dateRange}
              onDateRangeChange={invoiceListing.setDateRange}
              dateRangePlaceholder="Invoice date range"
              hasActiveFilters={invoiceListing.hasActiveFilters}
              onReset={invoiceListing.resetAll}
            />
            <DataTable
              columns={invColumns}
              data={invoices}
              isLoading={invLoading}
              page={invMeta?.page ?? 1}
              totalPages={invMeta?.totalPages ?? 1}
              total={invMeta?.total}
              onPageChange={invoiceListing.setPage}
              emptyMessage={(
                <ListingEmptyState
                  title="No invoices found"
                  description="Invoices for wallet recharges and subscription billing will appear here."
                />
              )}
            />
          </ListingTableCard>
        </TabsContent>
      </Tabs>

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
