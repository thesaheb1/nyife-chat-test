import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/shared/components/DataTable';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { usePermissions } from '@/core/hooks/usePermissions';
import type { WhatsAppFlow } from '@/core/types';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { useListingState } from '@/shared/hooks/useListingState';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingToolbar,
} from '@/shared/components';
import { flowCategories, humanizeFlowCategory } from './flowUtils';
import { useFlows, useSyncFlows } from './useFlows';

export function FlowListPage() {
  const navigate = useNavigate();
  const { canOrganization } = usePermissions();
  const listing = useListingState({
    initialFilters: {
      status: '',
      category: '',
    },
  });
  const { data: waAccounts = [] } = useWhatsAppAccounts();
  const activeAccounts = useMemo(
    () => waAccounts.filter((account) => account.status === 'active'),
    [waAccounts]
  );
  const { data, isLoading } = useFlows({
    page: listing.page,
    limit: 20,
    search: listing.debouncedSearch || undefined,
    status: listing.filters.status || undefined,
    category: listing.filters.category || undefined,
    date_from: listing.dateRange.from,
    date_to: listing.dateRange.to,
  });
  const syncFlows = useSyncFlows();
  const canCreateFlows = canOrganization('flows', 'create');
  const canUpdateFlows = canOrganization('flows', 'update');

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
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: ({ row }) => new Date(row.original.updated_at).toLocaleString(),
    },
  ], [navigate]);

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="WhatsApp Flows"
        description="Create, sync, publish, and track form-style WhatsApp Flows for lead capture, booking, feedback, support, and more."
        actions={
          <>
            {canUpdateFlows ? (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const result = await syncFlows.mutateAsync({ force: false });
                    toast.success(`Synced ${result.synced} flows (${result.created} created, ${result.updated} updated).`);
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, 'Failed to sync flows.'));
                  }
                }}
                disabled={syncFlows.isPending || activeAccounts.length === 0}
              >
                {syncFlows.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync from Meta
              </Button>
            ) : null}
            {canCreateFlows ? (
              <Button onClick={() => navigate('/flows/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Flow
              </Button>
            ) : null}
          </>
        }
      />


      <ListingTableCard>
        <ListingToolbar
          searchValue={listing.search}
          onSearchChange={listing.setSearch}
          searchPlaceholder="Search flows..."
          filters={[
            {
              id: 'status',
              value: listing.filters.status,
              placeholder: 'Status',
              onChange: (value) => listing.setFilter('status', value),
              allLabel: 'All statuses',
              options: [
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'DEPRECATED', label: 'Deprecated' },
              ],
            },
            {
              id: 'category',
              value: listing.filters.category,
              placeholder: 'Category',
              onChange: (value) => listing.setFilter('category', value),
              allLabel: 'All categories',
              options: flowCategories,
            },
          ]}
          dateRange={listing.dateRange}
          onDateRangeChange={listing.setDateRange}
          dateRangePlaceholder="Updated date range"
          hasActiveFilters={listing.hasActiveFilters}
          onReset={listing.resetAll}
        />
        <DataTable
          columns={columns}
          data={data?.flows || []}
          isLoading={isLoading}
          page={data?.meta.page ?? 1}
          totalPages={data?.meta.totalPages ?? 1}
          total={data?.meta.total ?? 0}
          onPageChange={listing.setPage}
          emptyMessage={
            <ListingEmptyState
              title="No flows found"
              description="Adjust the current filters or create your first WhatsApp Flow."
            />
          }
        />
      </ListingTableCard>
    </div>
  );
}
