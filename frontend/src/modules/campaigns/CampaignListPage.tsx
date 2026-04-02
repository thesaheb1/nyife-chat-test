import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/shared/components/DataTable';
import { useCampaigns } from './useCampaigns';
import { formatCurrency } from '@/shared/utils/formatters';
import type { Campaign } from '@/core/types';
import { useListingState } from '@/shared/hooks/useListingState';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingToolbar,
} from '@/shared/components';

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
  const listing = useListingState({
    initialFilters: {
      status: '',
    },
  });

  const { data, isLoading } = useCampaigns({
    page: listing.page,
    limit: 20,
    search: listing.debouncedSearch || undefined,
    status: listing.filters.status || undefined,
    date_from: listing.dateRange.from,
    date_to: listing.dateRange.to,
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
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          row.original.status === 'draft' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/campaigns/${row.original.id}/edit`);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Draft
            </Button>
          ) : null
        ),
      },
    ],
    [navigate]
  );

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="Campaigns"
        description={meta?.total !== undefined ? `${meta.total} campaigns` : 'Create and manage WhatsApp campaigns'}
        actions={
          <Button size="sm" onClick={() => navigate('/campaigns/create')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        }
      />


      <ListingTableCard>
        <ListingToolbar
          searchValue={listing.search}
          onSearchChange={listing.setSearch}
          searchPlaceholder="Search campaigns..."
          filters={[
            {
              id: 'status',
              value: listing.filters.status,
              placeholder: 'Status',
              onChange: (value) => listing.setFilter('status', value),
              allLabel: 'All statuses',
              options: [
                { value: 'draft', label: 'Draft' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'running', label: 'Running' },
                { value: 'paused', label: 'Paused' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
                { value: 'cancelled', label: 'Cancelled' },
              ],
            },
          ]}
          dateRange={listing.dateRange}
          onDateRangeChange={listing.setDateRange}
          dateRangePlaceholder="Created date range"
          hasActiveFilters={listing.hasActiveFilters}
          onReset={listing.resetAll}
        />
        <DataTable
          columns={columns}
          data={campaigns}
          isLoading={isLoading}
          page={meta?.page ?? 1}
          totalPages={meta?.totalPages ?? 1}
          total={meta?.total}
          onPageChange={listing.setPage}
          emptyMessage={
            <ListingEmptyState
              title="No campaigns found"
              description="Adjust the current filters or create your first campaign to get started."
            />
          }
        />
      </ListingTableCard>
    </div>
  );
}
