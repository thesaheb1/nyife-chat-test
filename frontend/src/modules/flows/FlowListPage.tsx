import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
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
import type { FlowAvailableAction, WhatsAppFlow } from '@/core/types';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { useListingState } from '@/shared/hooks/useListingState';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingToolbar,
} from '@/shared/components';
import { FlowActionsMenu } from './FlowActionsMenu';
import { getFlowAvailableActions } from './flowLifecycle';
import { flowCategories, humanizeFlowCategory } from './flowUtils';
import {
  useDeleteFlow,
  useDeprecateFlow,
  useDuplicateFlow,
  useFlows,
  usePublishFlow,
  useSyncFlows,
} from './useFlows';

type ConfirmAction = {
  type: 'publish' | 'delete' | 'deprecate';
  flow: WhatsAppFlow;
} | null;

function filterActionsForPermissions(
  actions: FlowAvailableAction[],
  permissions: {
    canCreateFlows: boolean;
    canUpdateFlows: boolean;
    canDeleteFlows: boolean;
  }
) {
  return actions.filter((action) => {
    if (action === 'view') {
      return true;
    }

    if (action === 'delete') {
      return permissions.canDeleteFlows;
    }

    if (action === 'clone') {
      return permissions.canCreateFlows;
    }

    return permissions.canUpdateFlows;
  });
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
  });
  const syncFlows = useSyncFlows();
  const publishFlow = usePublishFlow();
  const deleteFlow = useDeleteFlow();
  const deprecateFlow = useDeprecateFlow();
  const duplicateFlow = useDuplicateFlow();
  const canCreateFlows = canOrganization('flows', 'create');
  const canUpdateFlows = canOrganization('flows', 'update');
  const canDeleteFlows = canOrganization('flows', 'delete');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const permissions = { canCreateFlows, canUpdateFlows, canDeleteFlows };

  const columns: Array<ColumnDef<WhatsAppFlow, unknown>> = [
    {
      accessorKey: 'name',
      header: 'Flow',
      cell: ({ row }) => (
        <button
          className="min-w-55 text-left hover:text-primary hover:underline"
          data-row-click-ignore="true"
          onClick={() => navigate(`/flows/${row.original.id}`)}
        >
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
      cell: ({ row }) => (
        <span className="text-sm">{new Date(row.original.updated_at).toLocaleDateString()}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const flow = row.original;
        const flowBusy = busyKey === `clone:${flow.id}`
          || busyKey === `publish:${flow.id}`
          || busyKey === `deprecate:${flow.id}`
          || busyKey === `delete:${flow.id}`;
        const actions = filterActionsForPermissions(getFlowAvailableActions(flow), permissions);

        return (
          <div
            className="flex justify-end"
            data-row-click-ignore="true"
            onClick={(event) => event.stopPropagation()}
          >
            <FlowActionsMenu
              actions={actions}
              isBusy={flowBusy}
              onView={() => navigate(`/flows/${flow.id}`)}
              onEdit={() => navigate(`/flows/${flow.id}/edit`)}
              onPublish={() => setConfirmAction({ type: 'publish', flow })}
              onClone={async () => {
                const actionKey = `clone:${flow.id}`;
                setBusyKey(actionKey);
                try {
                  const duplicate = await duplicateFlow.mutateAsync(flow.id);
                  toast.success('Flow cloned successfully.');
                  navigate(`/flows/${duplicate.id}/edit`);
                } catch (error) {
                  toast.error(getApiErrorMessage(error, 'Failed to clone flow.'));
                } finally {
                  setBusyKey((current) => (current === actionKey ? null : current));
                }
              }}
              onDeprecate={() => setConfirmAction({ type: 'deprecate', flow })}
              onDelete={() => setConfirmAction({ type: 'delete', flow })}
            />
          </div>
        );
      },
    },
  ];

  const confirmDescription = confirmAction?.type === 'publish'
    ? 'Nyife will publish the current draft to Meta using the saved canonical JSON definition.'
    : confirmAction?.type === 'deprecate'
      ? 'Deprecation stops the active Meta flow from remaining in service for new sends.'
      : 'Draft deletion is permanent. If this flow is linked to a Meta draft, Nyife will delete that draft remotely before removing the local flow.';

  return (
    <>
      <div className="space-y-6">
        <ListingPageHeader
          title="WhatsApp Flows"
          description="Create, sync, publish, clone, deprecate, and track form-style WhatsApp Flows for lead capture, booking, support, and survey journeys."
          actions={
            <>
              {canUpdateFlows ? (
                <Button
                  className="w-full sm:w-auto"
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
                <Button className="w-full sm:w-auto" onClick={() => navigate('/flows/create')}>
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
                  { value: 'THROTTLED', label: 'Throttled' },
                  { value: 'BLOCKED', label: 'Blocked' },
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
            hasActiveFilters={listing.hasActiveFilters}
            onReset={listing.resetAll}
          />
          <DataTable
            columns={columns}
            data={data?.flows || []}
            isLoading={isLoading}
            page={data?.meta.page ?? listing.page}
            totalPages={data?.meta.totalPages ?? 1}
            total={data?.meta.total ?? 0}
            onPageChange={listing.setPage}
            onRowClick={(flow) => navigate(`/flows/${flow.id}`)}
            emptyMessage={(
              <div className="space-y-4 py-6">
                <ListingEmptyState
                  title="No flows found"
                  description="Create your first flow or adjust the filters to see matching results."
                />
                {canCreateFlows ? (
                  <div className="flex justify-center">
                    <Button className="w-full sm:w-auto" onClick={() => navigate('/flows/create')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Flow
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          />
        </ListingTableCard>
      </div>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'publish'
                ? 'Publish this flow?'
                : confirmAction?.type === 'deprecate'
                  ? 'Deprecate this flow?'
                  : 'Delete this flow?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
              onClick={async (event) => {
                event.preventDefault();
                if (!confirmAction) {
                  return;
                }

                const { flow, type } = confirmAction;
                const actionKey = `${type}:${flow.id}`;
                setConfirmAction(null);
                setBusyKey(actionKey);

                try {
                  if (type === 'publish') {
                    await publishFlow.mutateAsync({ id: flow.id });
                    toast.success('Flow published successfully.');
                  } else if (type === 'deprecate') {
                    await deprecateFlow.mutateAsync(flow.id);
                    toast.success('Flow deprecated successfully.');
                  } else {
                    await deleteFlow.mutateAsync(flow.id);
                    toast.success('Flow deleted successfully.');
                  }
                } catch (error) {
                  toast.error(
                    getApiErrorMessage(
                      error,
                      type === 'publish'
                        ? 'Failed to publish flow.'
                        : type === 'deprecate'
                          ? 'Failed to deprecate flow.'
                          : 'Failed to delete flow.'
                    )
                  );
                } finally {
                  setBusyKey((current) => (current === actionKey ? null : current));
                }
              }}
            >
              {confirmAction?.type === 'publish'
                ? 'Publish'
                : confirmAction?.type === 'deprecate'
                  ? 'Deprecate'
                  : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FlowListPage;
