import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Plus, Webhook } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { useAutomations, useUpdateAutomationStatus } from './useAutomations';
import { useDebounce } from '@/core/hooks';
import type { Automation } from '@/core/types';

const TYPE_LABELS: Record<string, string> = {
  basic_reply: 'Basic Reply',
  advanced_flow: 'Advanced Flow',
  webhook_trigger: 'Webhook',
  api_trigger: 'API Trigger',
};

export function AutomationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAutomations({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
  });
  const updateStatus = useUpdateAutomationStatus();

  const automations = data?.data?.automations ?? [];
  const meta = data?.meta;

  const toggleStatus = (auto: Automation) => {
    const newStatus = auto.status === 'active' ? 'inactive' : 'active';
    updateStatus.mutate(
      { id: auto.id, status: newStatus },
      { onSuccess: () => toast.success(`Automation ${newStatus}`) }
    );
  };

  const columns: ColumnDef<Automation, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <button
          className="text-left font-medium hover:underline"
          onClick={() => navigate(`/automations/${row.original.id}`)}
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[getValue() as string] || (getValue() as string)}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.status === 'active'}
            onCheckedChange={() => toggleStatus(row.original)}
            disabled={row.original.status === 'draft'}
          />
          <span className="text-xs capitalize">{row.original.status}</span>
        </div>
      ),
    },
    {
      id: 'triggered',
      header: 'Triggered',
      cell: ({ row }) => {
        const stats = row.original.stats as { triggered_count?: number } | null;
        return <span className="tabular-nums">{stats?.triggered_count ?? 0}</span>;
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('automations.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total !== undefined ? `${meta.total} automations` : 'Auto-reply and workflow automations'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/automations/webhooks')}>
            <Webhook className="mr-2 h-4 w-4" />
            Manage Webhooks
          </Button>
          <Button size="sm" onClick={() => navigate('/automations/create')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('automations.createAutomation')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-56"
        />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="basic_reply">Basic Reply</SelectItem>
            <SelectItem value="advanced_flow">Advanced Flow</SelectItem>
            <SelectItem value="webhook_trigger">Webhook</SelectItem>
            <SelectItem value="api_trigger">API Trigger</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={automations}
        isLoading={isLoading}
        page={meta?.page ?? 1}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total}
        onPageChange={setPage}
        emptyMessage="No automations yet. Create your first automation."
      />
    </div>
  );
}
