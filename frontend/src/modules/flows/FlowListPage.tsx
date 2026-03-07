import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import type { WhatsAppFlow } from '@/core/types';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { flowCategories, humanizeFlowCategory } from './flowUtils';
import { useFlows, useSyncFlows } from './useFlows';

export function FlowListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [page, setPage] = useState(1);
  const [syncWabaId, setSyncWabaId] = useState('');
  const [forceSync, setForceSync] = useState(false);
  const { data: waAccounts = [] } = useWhatsAppAccounts();
  const { data, isLoading } = useFlows({
    page,
    limit: 20,
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
    waba_id: wabaId || undefined,
  });
  const syncFlows = useSyncFlows();

  const wabaOptions = Array.from(
    new Map(
      waAccounts.map((account) => [
        account.waba_id,
        {
          value: account.waba_id,
          label: `${account.verified_name || account.display_phone || account.waba_id} (${account.waba_id})`,
        },
      ])
    ).values()
  );

  const columns = useMemo<ColumnDef<WhatsAppFlow, unknown>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Flow',
      cell: ({ row }) => (
        <button className="text-left hover:underline" onClick={() => navigate(`/flows/${row.original.id}`)}>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.meta_flow_id || 'Not linked to Meta yet'}</div>
        </button>
      ),
    },
    {
      accessorKey: 'categories',
      header: 'Categories',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.categories.slice(0, 2).map((category) => (
            <Badge key={category} variant="outline" className="text-[11px]">{humanizeFlowCategory(category)}</Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
    },
    {
      accessorKey: 'waba_id',
      header: 'WABA',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.waba_id || '-'}</span>,
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: ({ row }) => new Date(row.original.updated_at).toLocaleString(),
    },
  ], [navigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">WhatsApp Flows</h1>
          <p className="text-sm text-muted-foreground">Create, sync, publish, and track form-style WhatsApp Flows for lead capture, booking, feedback, support, and more.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            if (!syncWabaId.trim()) {
              toast.error('Choose a WABA before syncing.');
              return;
            }
            try {
              const result = await syncFlows.mutateAsync({ waba_id: syncWabaId.trim(), force: forceSync });
              toast.success(`Synced ${result.synced} flows (${result.created} created, ${result.updated} updated).`);
            } catch (error) {
              toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to sync flows.');
            }
          }} disabled={syncFlows.isPending}>
            {syncFlows.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync from Meta
          </Button>
          <Button onClick={() => navigate('/flows/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create flow
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters and sync</CardTitle>
          <CardDescription>Filter local flows or sync the latest definitions from Meta for a connected WABA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_160px_180px_180px_1fr]">
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search flows..." />
          <Select value={status || 'all'} onValueChange={(value) => { setStatus(value === 'all' ? '' : value); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="DEPRECATED">Deprecated</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category || 'all'} onValueChange={(value) => { setCategory(value === 'all' ? '' : value); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {flowCategories.map((categoryOption) => (
                <SelectItem key={categoryOption.value} value={categoryOption.value}>{categoryOption.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={wabaId || 'all'} onValueChange={(value) => { setWabaId(value === 'all' ? '' : value); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="All WABAs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All WABAs</SelectItem>
              {wabaOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Label>Sync WABA</Label>
            <Select value={syncWabaId || 'manual'} onValueChange={(value) => setSyncWabaId(value === 'manual' ? '' : value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual entry</SelectItem>
                {wabaOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={syncWabaId} onChange={(event) => setSyncWabaId(event.target.value)} placeholder="WABA ID" />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Force overwrite dirty flows</p>
                <p className="text-xs text-muted-foreground">Use this only when you want Meta to replace local edits.</p>
              </div>
              <Switch checked={forceSync} onCheckedChange={setForceSync} />
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data?.flows || []}
        isLoading={isLoading}
        page={data?.meta.page ?? 1}
        totalPages={data?.meta.totalPages ?? 1}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        emptyMessage="No flows found. Create your first WhatsApp Flow to get started."
      />
    </div>
  );
}
