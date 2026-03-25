import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/core/hooks/usePermissions';
import type { Template } from '@/core/types';
import { DataTable } from '@/shared/components/DataTable';
import { resolveWhatsAppPreviewAccount } from '@/modules/whatsapp/accountOptions';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { useListingState } from '@/shared/hooks/useListingState';
import {
  ListingEmptyState,
  ListingPageHeader,
  ListingTableCard,
  ListingToolbar,
} from '@/shared/components';
import {
  TEMPLATE_CATEGORY_OPTIONS,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
  getTemplateAvailableActions,
  getTemplateLanguageLabel,
  resolveTemplateMetaStatus,
} from './templateCatalog';
import { useTemplates } from './useTemplates';
import { TemplateActionsMenu } from './TemplateActionsMenu';
import { TemplateActionDialogs } from './TemplateActionDialogs';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';
import { TemplateStatusBadges } from './TemplateStatusBadges';
import { useTemplateLifecycleActions } from './useTemplateLifecycleActions';

export function TemplateListPage() {
  const navigate = useNavigate();
  const { canOrganization } = usePermissions();
  const listing = useListingState({
    initialFilters: {
      status: '',
      category: '',
      type: '',
    },
  });

  const { data: waAccounts } = useWhatsAppAccounts();
  const activeAccountCount = useMemo(
    () => (waAccounts || []).filter((account) => account.status === 'active').length,
    [waAccounts]
  );
// Validation checklist Ui is taking so much space can we make it compact not 

  const { data, isLoading } = useTemplates({
    page: listing.page,
    limit: 20,
    search: listing.debouncedSearch || undefined,
    status: listing.filters.status || undefined,
    category: listing.filters.category || undefined,
    type: listing.filters.type || undefined,
  });

  const lifecycle = useTemplateLifecycleActions();
  const canCreateTemplates = canOrganization('templates', 'create');
  const canUpdateTemplates = canOrganization('templates', 'update');
  const canDeleteTemplates = canOrganization('templates', 'delete');
  const [previewTarget, setPreviewTarget] = useState<Template | null>(null);

  const templates = data?.data?.templates ?? [];
  const meta = data?.meta;
  const previewAccount = useMemo(
    () => resolveWhatsAppPreviewAccount(waAccounts, {
      waAccountId: previewTarget?.wa_account_id,
      wabaId: previewTarget?.waba_id,
    }),
    [previewTarget?.wa_account_id, previewTarget?.waba_id, waAccounts]
  );

  const openPublishDialog = useCallback((template: Template) => {
    if (!canUpdateTemplates) {
      return;
    }
    lifecycle.setPublishTarget(template);
  }, [canUpdateTemplates, lifecycle]);

  const openPreview = useCallback((template: Template) => {
    setPreviewTarget(template);
  }, []);

  const columns = useMemo<ColumnDef<Template, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Template',
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="min-w-55">
              <button
                className="text-left font-semibold hover:text-primary hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  openPreview(template);
                }}
              >
                {template.display_name || template.name}
              </button>
              <div className="mt-1 text-xs text-muted-foreground">{template.name}</div>
            </div>
          );
        },
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: ({ row }) => {
          const template = row.original;

          return (
            <div className="space-y-2">
              <Badge variant="outline">{template.category}</Badge>
              <div className="text-xs text-muted-foreground">{TEMPLATE_TYPE_LABELS[template.type]}</div>
            </div>
          );
        },
      },
      {
        accessorKey: 'language',
        header: 'Language',
        cell: ({ getValue }) => (
          <div className="min-w-32.5 text-sm">{getTemplateLanguageLabel(getValue() as string)}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const template = row.original;
          const effectiveMetaStatus = resolveTemplateMetaStatus(template);
          return (
            <TemplateStatusBadges
              template={template}
              showMetaStatus={effectiveMetaStatus === 'PENDING_DELETION' || effectiveMetaStatus === 'APPEAL_REQUESTED'}
            />
          );
        },
      },
      {
        accessorKey: 'updated_at',
        header: 'Updated',
        cell: ({ row }) => {
          const date = row.original.last_synced_at || row.original.updated_at;
          return <span className="text-sm">{new Date(date).toLocaleDateString()}</span>;
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const template = row.original;
          const actions = getTemplateAvailableActions(template).filter((action) => {
            if (action === 'view') {
              return true;
            }
            if (action === 'sync') {
              return false;
            }
            if (action === 'edit' || action === 'publish') {
              return canUpdateTemplates;
            }
            if (action === 'delete') {
              return canDeleteTemplates;
            }
            return false;
          });

          return (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <TemplateActionsMenu
                actions={actions}
                isBusy={lifecycle.busyKey === `publish:${template.id}` || lifecycle.busyKey === `delete:${template.id}`}
                onView={() => openPreview(template)}
                onEdit={() => navigate(`/templates/${template.id}/edit`)}
                onPublish={() => openPublishDialog(template)}
                onDelete={() => lifecycle.setDeleteTarget(template)}
              />
            </div>
          );
        },
      },
    ],
    [
      canDeleteTemplates,
      canUpdateTemplates,
      lifecycle.busyKey,
      navigate,
      openPreview,
      openPublishDialog,
    ]
  );

  return (
    <div className="space-y-6">
      <ListingPageHeader
        title="WhatsApp Templates"
        description="Manage template inventory for the current organization. Meta sync and publish actions run through the connected WhatsApp account automatically."
        actions={
          <>
            {canUpdateTemplates ? (
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                onClick={() => void lifecycle.syncTemplate('sync:global')}
                disabled={lifecycle.syncTemplates.isPending || activeAccountCount === 0}
              >
                {lifecycle.busyKey === 'sync:global' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync from Meta
              </Button>
            ) : null}
            {canCreateTemplates ? (
              <Button className="w-full sm:w-auto" onClick={() => navigate('/templates/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            ) : null}
          </>
        }
      />
      <ListingTableCard>
        <ListingToolbar
          searchValue={listing.search}
          onSearchChange={listing.setSearch}
          searchPlaceholder="Search by template name or display name"
          filters={[
            {
              id: 'status',
              value: listing.filters.status,
              placeholder: 'Status',
              onChange: (value) => listing.setFilter('status', value),
              options: Object.entries(TEMPLATE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
              allLabel: 'All statuses',
            },
            {
              id: 'category',
              value: listing.filters.category,
              placeholder: 'Category',
              onChange: (value) => listing.setFilter('category', value),
              options: TEMPLATE_CATEGORY_OPTIONS,
              allLabel: 'All categories',
            },
            {
              id: 'type',
              value: listing.filters.type,
              placeholder: 'Type',
              onChange: (value) => listing.setFilter('type', value),
              options: TEMPLATE_TYPE_OPTIONS,
              allLabel: 'All types',
            },
          ]}
          hasActiveFilters={listing.hasActiveFilters}
          onReset={listing.resetAll}
        />

        <DataTable
          columns={columns}
          data={templates}
          isLoading={isLoading}
          page={meta?.page ?? 1}
          totalPages={meta?.totalPages ?? 1}
          total={meta?.total}
          onPageChange={listing.setPage}
          onRowClick={(template) => openPreview(template)}
          emptyMessage={
            <ListingEmptyState
              title="No templates found"
              description="Adjust the current filters or create a new template to get started."
            />
          }
        />
      </ListingTableCard>

      <TemplateActionDialogs
        publishTarget={lifecycle.publishTarget}
        deleteTarget={lifecycle.deleteTarget}
        publishPending={lifecycle.publishTemplate.isPending}
        deletePending={lifecycle.deleteTemplate.isPending}
        activeAccountCount={activeAccountCount}
        onPublishOpenChange={(open) => {
          if (!open) {
            lifecycle.setPublishTarget(null);
          }
        }}
        onDeleteOpenChange={(open) => {
          if (!open) {
            lifecycle.setDeleteTarget(null);
          }
        }}
        onConfirmPublish={lifecycle.confirmPublish}
        onConfirmDelete={lifecycle.confirmDelete}
      />

      <TemplatePreviewDialog
        template={previewTarget}
        open={Boolean(previewTarget)}
        accountName={previewAccount?.verified_name || previewAccount?.display_phone || null}
        accountPhone={previewAccount?.display_phone}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTarget(null);
          }
        }}
      />
    </div>
  );
}
