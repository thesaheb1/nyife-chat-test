import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { useCampaigns } from './useCampaigns';
import { useDebounce } from '@/core/hooks';
import { formatCurrency } from '@/shared/utils/formatters';
import type { Campaign } from '@/core/types';

const STATUS_COLORS: Record<Campaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  scheduled: 'bg-blue-100 text-blue-800',
  running: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-300 text-gray-700',
};

const TARGET_LABELS: Record<Campaign['target_type'], string> = {
  group: 'Groups',
  contacts: 'Contacts',
  tags: 'Tags',
  all: 'All Contacts',
};

export function CampaignListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCampaigns({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
  });

  const campaigns = data?.data?.campaigns ?? [];
  const meta = data?.meta;

  const columns = useMemo<ColumnDef<Campaign, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Campaign',
        cell: ({ row }) => (
          <button
            className="text-left font-medium hover:underline"
            onClick={() => navigate(`/campaigns/${row.original.id}`)}
          >
            <div>{row.original.name}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {row.original.type} &middot; {TARGET_LABELS[row.original.target_type]}
            </div>
          </button>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as Campaign['status'];
          return (
            <Badge className={`${STATUS_COLORS[status]} text-xs`} variant="secondary">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        },
      },
      {
        header: 'Recipients',
        accessorKey: 'total_recipients',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.total_recipients.toLocaleString()}</span>
        ),
      },
      {
        header: 'Delivery',
        id: 'delivery',
        cell: ({ row }) => {
          const { sent_count, delivered_count, read_count, failed_count, total_recipients } = row.original;
          if (total_recipients === 0) return <span className="text-muted-foreground">—</span>;
          const processed = sent_count + delivered_count + read_count + failed_count;
          const successRate = processed > 0 ? (((delivered_count + read_count) / processed) * 100).toFixed(0) : '0';
          return (
            <div className="text-sm">
              <span className="tabular-nums">{successRate}%</span>
              <span className="ml-1 text-xs text-muted-foreground">
                ({delivered_count + read_count}/{processed})
              </span>
            </div>
          );
        },
      },
      {
        header: 'Cost',
        id: 'cost',
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.actual_cost > 0 ? formatCurrency(row.original.actual_cost) : formatCurrency(row.original.estimated_cost)}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
      },
    ],
    [navigate]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total !== undefined ? `${meta.total} campaigns` : 'Create and manage WhatsApp campaigns'}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/campaigns/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Campaign
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 w-64"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={campaigns}
        isLoading={isLoading}
        page={meta?.page ?? 1}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total}
        onPageChange={setPage}
        emptyMessage="No campaigns yet. Create your first campaign to get started."
      />
    </div>
  );
}
