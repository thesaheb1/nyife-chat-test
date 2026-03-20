import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useDebounce } from '@/core/hooks';
import { usePermissions } from '@/core/hooks/usePermissions';
import type { Template } from '@/core/types';
import { DataTable } from '@/shared/components/DataTable';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import {
  TEMPLATE_ACTION_LABELS,
  TEMPLATE_CATEGORY_OPTIONS,
  TEMPLATE_STATUS_CLASSES,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
  getTemplateAvailableActions,
  getTemplateLanguageLabel,
} from './templateCatalog';
import { useDeleteTemplate, usePublishTemplate, useSyncTemplates, useTemplates } from './useTemplates';

export function TemplateListPage() {
  const navigate = useNavigate();
  const { canOrganization } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [publishTarget, setPublishTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [rowBusyKey, setRowBusyKey] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: waAccounts } = useWhatsAppAccounts();
  const activeAccountCount = useMemo(
    () => (waAccounts || []).filter((account) => account.status === 'active').length,
    [waAccounts]
  );

  const { data, isLoading } = useTemplates({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    type: typeFilter || undefined,
  });

  const publishTemplate = usePublishTemplate();
  const syncTemplates = useSyncTemplates();
  const deleteTemplate = useDeleteTemplate();
  const canCreateTemplates = canOrganization('templates', 'create');
  const canUpdateTemplates = canOrganization('templates', 'update');
  const canDeleteTemplates = canOrganization('templates', 'delete');

  const templates = data?.data?.templates ?? [];
  const meta = data?.meta;

  const setBusy = (value: string | null) => {
    setRowBusyKey(value);
  };

  const openPublishDialog = useCallback((template: Template) => {
    if (!canUpdateTemplates) {
      return;
    }
    setPublishTarget(template);
  }, [canUpdateTemplates]);

  const handleSync = useCallback(async (scopeKey: string, template?: Template | null) => {
    if (!canUpdateTemplates) {
      return;
    }
    setBusy(scopeKey);
    try {
      const result = await syncTemplates.mutateAsync(template?.wa_account_id || undefined);
      toast.success(`Synced ${result.synced} templates (${result.created} created, ${result.updated} updated).`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to sync templates.'));
    } finally {
      setBusy(null);
    }
  }, [canUpdateTemplates, syncTemplates]);

  const handlePublish = async () => {
    if (!publishTarget) {
      return;
    }

    setBusy(`publish:${publishTarget.id}`);
    try {
      await publishTemplate.mutateAsync({
        id: publishTarget.id,
        wa_account_id: publishTarget.wa_account_id || undefined,
      });
      toast.success('Template submitted to Meta for review.');
      setPublishTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to submit template.'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setBusy(`delete:${deleteTarget.id}`);
    try {
      await deleteTemplate.mutateAsync(deleteTarget.id);
      toast.success('Template deleted.');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete template.'));
    } finally {
      setBusy(null);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setTypeFilter('');
    setPage(1);
  };

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
                  navigate(`/templates/${template.id}`);
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
        cell: ({ getValue }) => {
          const status = getValue() as Template['status'];
          return (
            <Badge variant="outline" className={TEMPLATE_STATUS_CLASSES[status]}>
              {TEMPLATE_STATUS_LABELS[status]}
            </Badge>
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
            if (action === 'edit' || action === 'publish' || action === 'sync') {
              return canUpdateTemplates;
            }
            if (action === 'delete') {
              return canDeleteTemplates;
            }
            return false;
          });
          const isBusy =
            rowBusyKey === `publish:${template.id}` ||
            rowBusyKey === `delete:${template.id}` ||
            rowBusyKey === `sync:${template.id}`;

          return (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Template actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {actions.includes('view') ? (
                    <DropdownMenuItem onSelect={() => navigate(`/templates/${template.id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      {TEMPLATE_ACTION_LABELS.view}
                    </DropdownMenuItem>
                  ) : null}
                  {actions.includes('edit') ? (
                    <DropdownMenuItem onSelect={() => navigate(`/templates/${template.id}/edit`)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {TEMPLATE_ACTION_LABELS.edit}
                    </DropdownMenuItem>
                  ) : null}
                  {actions.includes('publish') ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        openPublishDialog(template);
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {TEMPLATE_ACTION_LABELS.publish}
                    </DropdownMenuItem>
                  ) : null}
                  {actions.includes('sync') ? (
                    <DropdownMenuItem
                      disabled={syncTemplates.isPending}
                      onSelect={(event) => {
                        event.preventDefault();
                        void handleSync(`sync:${template.id}`, template);
                      }}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {TEMPLATE_ACTION_LABELS.sync}
                    </DropdownMenuItem>
                  ) : null}
                  {actions.includes('delete') ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={(event) => {
                        event.preventDefault();
                        setDeleteTarget(template);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {TEMPLATE_ACTION_LABELS.delete}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [
      canDeleteTemplates,
      canUpdateTemplates,
      handleSync,
      navigate,
      openPublishDialog,
      rowBusyKey,
      syncTemplates.isPending,
    ]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-linear-to-r from-[#0f766e] via-[#115e59] to-[#134e4a] text-white shadow-lg">
        <CardHeader className="border-none pb-0">
          <CardTitle className="text-2xl">WhatsApp Templates</CardTitle>
          <CardDescription className="text-emerald-50/80">
            Manage template inventory for the current organization and let Nyife route Meta sync and publish actions through the connected WhatsApp account automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6 pt-4 sm:flex-row sm:justify-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            {canUpdateTemplates ? (
              <Button
                variant="secondary"
                onClick={() => void handleSync('sync:global')}
                disabled={syncTemplates.isPending || activeAccountCount === 0}
              >
                {rowBusyKey === 'sync:global' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync from Meta
              </Button>
            ) : null}
            {canCreateTemplates ? (
              <Button className="bg-white text-emerald-900 hover:bg-emerald-50" onClick={() => navigate('/templates/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Filter templates</CardTitle>
            <CardDescription>
              Narrow by status, type, and category. Template actions use the connected WhatsApp account automatically.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]">
          <Input
            placeholder="Search by template name or display name"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            value={statusFilter || 'all'}
            onValueChange={(value) => {
              setStatusFilter(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(TEMPLATE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter || 'all'}
            onValueChange={(value) => {
              setCategoryFilter(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {TEMPLATE_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter || 'all'}
            onValueChange={(value) => {
              setTypeFilter(value === 'all' ? '' : value);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TEMPLATE_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={resetFilters}>
            Reset
          </Button>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={templates}
        isLoading={isLoading}
        page={meta?.page ?? 1}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total}
        onPageChange={setPage}
        onRowClick={(template) => navigate(`/templates/${template.id}`)}
        emptyMessage="No templates found for the selected filters."
      />

      <Dialog
        open={!!publishTarget}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPublishTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit template to Meta</DialogTitle>
            <DialogDescription>
              Only draft or rejected templates can be resubmitted. Nyife will use the connected WhatsApp account automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="font-semibold">{publishTarget?.display_name || publishTarget?.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {publishTarget ? TEMPLATE_TYPE_LABELS[publishTarget.type] : ''} template
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPublishTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishTemplate.isPending || activeAccountCount === 0}>
              {publishTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit to Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.display_name || deleteTarget?.name} will be removed from Nyife. If it was already synced or submitted,
              the backend will also attempt the matching Meta cleanup where supported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
