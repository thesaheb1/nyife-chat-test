import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { FlowActionsMenu, type FlowActionKey } from './FlowActionsMenu';
import { flowCategories, humanizeFlowCategory } from './flowUtils';
import {
  useDeleteFlow,
  useFlows,
  usePublishFlow,
  useSaveFlowToMeta,
  useSyncFlows,
} from './useFlows';

type ConfirmAction = {
  type: 'publish' | 'delete';
  flow: WhatsAppFlow;
} | null;

function hasDeferredDataExchange(flow: WhatsAppFlow) {
  return Object.keys(flow.data_exchange_config || {}).length > 0;
}

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
  const saveToMeta = useSaveFlowToMeta();
  const publishFlow = usePublishFlow();
  const deleteFlow = useDeleteFlow();
  const canCreateFlows = canOrganization('flows', 'create');
  const canUpdateFlows = canOrganization('flows', 'update');
  const canDeleteFlows = canOrganization('flows', 'delete');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const handleSaveToMeta = async (flow: WhatsAppFlow) => {
    const actionKey = `save:${flow.id}`;
    setBusyKey(actionKey);
    try {
      await saveToMeta.mutateAsync({ id: flow.id });
      toast.success('Flow saved to Meta successfully.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save flow to Meta.'));
    } finally {
      setBusyKey((current) => (current === actionKey ? null : current));
    }
  };

  const columns: Array<ColumnDef<WhatsAppFlow, unknown>> = [
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
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{row.original.status}</Badge>
          {row.original.meta_status && row.original.meta_status !== row.original.status ? (
            <Badge variant="outline">{row.original.meta_status}</Badge>
          ) : null}
          {row.original.can_send_message === false ? (
            <Badge variant="destructive">Send blocked</Badge>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'updated_at',
      header: 'Updated',
      cell: ({ row }) => new Date(row.original.updated_at).toLocaleString(),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const flow = row.original;
        const flowBusy = busyKey === `save:${flow.id}`
          || busyKey === `publish:${flow.id}`
          || busyKey === `delete:${flow.id}`;
        const actions: FlowActionKey[] = ['view'];

        if (canUpdateFlows) {
          actions.push('edit');
          if (!hasDeferredDataExchange(flow)) {
            actions.push('save_to_meta');
            if (flow.status !== 'DEPRECATED') {
              actions.push('publish');
            }
          }
        }

        if (flow.preview_url) {
          actions.push('open_meta_preview');
        }

        if (canDeleteFlows) {
          actions.push('delete');
        }

        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <FlowActionsMenu
              actions={actions}
              isBusy={flowBusy}
              onView={() => navigate(`/flows/${flow.id}`)}
              onEdit={() => navigate(`/flows/${flow.id}/edit`)}
              onSaveToMeta={() => void handleSaveToMeta(flow)}
              onPublish={() => setConfirmAction({ type: 'publish', flow })}
              onOpenMetaPreview={() => {
                if (flow.preview_url) {
                  window.open(flow.preview_url, '_blank', 'noopener,noreferrer');
                }
              }}
              onDelete={() => setConfirmAction({ type: 'delete', flow })}
            />
          </div>
        );
      },
    },
  ];

  const confirmDescription = confirmAction?.type === 'publish'
    ? 'Nyife will save the latest version to Meta, refresh validation and health details, and then publish the linked flow. If this flow is already published, Meta will move it back to draft while applying the updated version before publishing again.'
    : 'Draft deletion is permanent. If this flow is linked to a Meta draft, Nyife will delete that draft remotely before removing the local flow.';

  return (
    <>
      <div className="space-y-6">
        <ListingPageHeader
          title="WhatsApp Flows"
          description="Create, sync, publish, and track form-style WhatsApp Flows for lead capture, booking, support, and survey journeys."
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

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'publish' ? 'Publish flow to Meta?' : 'Delete this flow?'}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
              onClick={(event) => {
                event.preventDefault();
                if (!confirmAction) {
                  return;
                }

                const { flow, type } = confirmAction;
                setConfirmAction(null);

                if (type === 'publish') {
                  const actionKey = `publish:${flow.id}`;
                  setBusyKey(actionKey);
                  publishFlow.mutate(
                    { id: flow.id },
                    {
                      onSuccess: () => toast.success('Flow published successfully.'),
                      onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to publish flow.')),
                      onSettled: () => setBusyKey((current) => (current === actionKey ? null : current)),
                    }
                  );
                  return;
                }

                const actionKey = `delete:${flow.id}`;
                setBusyKey(actionKey);
                deleteFlow.mutate(flow.id, {
                  onSuccess: () => toast.success('Flow deleted successfully.'),
                  onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to delete flow.')),
                  onSettled: () => setBusyKey((current) => (current === actionKey ? null : current)),
                });
              }}
            >
              {confirmAction?.type === 'publish' ? 'Publish' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
