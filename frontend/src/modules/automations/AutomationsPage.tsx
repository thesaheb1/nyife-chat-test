import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Plus, Webhook } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { DataTable } from '@/shared/components/DataTable';
import { useAutomations, useUpdateAutomationStatus } from './useAutomations';
import type { Automation } from '@/core/types';
import { useListingState } from '@/shared/hooks/useListingState';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingToolbar,
} from '@/shared/components';

const TYPE_LABELS: Record<string, string> = {
  basic_reply: 'Basic Reply',
  advanced_flow: 'Advanced Flow',
  webhook_trigger: 'Webhook',
  api_trigger: 'API Trigger',
};

export function AutomationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const listing = useListingState({
    initialFilters: {
      status: '',
      type: '',
    },
  });

  const { data, isLoading } = useAutomations({
    page: listing.page,
    limit: 20,
    search: listing.debouncedSearch || undefined,
    status: listing.filters.status || undefined,
    type: listing.filters.type || undefined,
    date_from: listing.dateRange.from,
    date_to: listing.dateRange.to,
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
    <div className="space-y-6">
      <ListingPageHeader
        title={t('automations.title')}
        description={meta?.total !== undefined ? `${meta.total} automations` : 'Auto-reply and workflow automations'}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/automations/webhooks')}>
              <Webhook className="mr-2 h-4 w-4" />
              Manage Webhooks
            </Button>
            <Button size="sm" onClick={() => navigate('/automations/create')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('automations.createAutomation')}
            </Button>
          </>
        }
      />


      <ListingTableCard>
        <ListingToolbar
          searchValue={listing.search}
          onSearchChange={listing.setSearch}
          searchPlaceholder="Search automations..."
          filters={[
            {
              id: 'status',
              value: listing.filters.status,
              placeholder: 'Status',
              onChange: (value) => listing.setFilter('status', value),
              allLabel: 'All statuses',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'draft', label: 'Draft' },
              ],
            },
            {
              id: 'type',
              value: listing.filters.type,
              placeholder: 'Type',
              onChange: (value) => listing.setFilter('type', value),
              allLabel: 'All types',
              options: [
                { value: 'basic_reply', label: 'Basic Reply' },
                { value: 'advanced_flow', label: 'Advanced Flow' },
                { value: 'webhook_trigger', label: 'Webhook' },
                { value: 'api_trigger', label: 'API Trigger' },
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
          data={automations}
          isLoading={isLoading}
          page={meta?.page ?? 1}
          totalPages={meta?.totalPages ?? 1}
          total={meta?.total}
          onPageChange={listing.setPage}
          emptyMessage={
            <ListingEmptyState
              title="No automations found"
              description="Adjust the current filters or create your first automation."
            />
          }
        />
      </ListingTableCard>
    </div>
  );
}
