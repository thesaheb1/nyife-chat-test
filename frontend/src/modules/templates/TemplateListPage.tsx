import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, MoreHorizontal, Plus, RefreshCw, Send, Trash2, Pencil, Eye } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/shared/components/DataTable';
import { useDebounce } from '@/core/hooks';
import type { Template } from '@/core/types';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { TemplateOptionSelect } from './TemplateOptionSelect';
import {
  TEMPLATE_ACTION_LABELS,
  TEMPLATE_CATEGORY_OPTIONS,
  TEMPLATE_STATUS_CLASSES,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
  buildTemplateWabaOptions,
  getTemplateAvailableActions,
  getTemplateLanguageLabel,
} from './templateCatalog';
import {
  useDeleteTemplate,
  usePublishTemplate,
  useSyncTemplates,
  useTemplates,
} from './useTemplates';

export function TemplateListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [wabaFilter, setWabaFilter] = useState('');
  const [page, setPage] = useState(1);
  const [syncOpen, setSyncOpen] = useState(false);
  const [publishTarget, setPublishTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [dialogWabaId, setDialogWabaId] = useState('');
  const [rowBusyKey, setRowBusyKey] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: waAccounts } = useWhatsAppAccounts();
  const wabaOptions = useMemo(() => buildTemplateWabaOptions(waAccounts), [waAccounts]);

  const { data, isLoading } = useTemplates({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    type: typeFilter || undefined,
    waba_id: wabaFilter || undefined,
  });

  const publishTemplate = usePublishTemplate();
  const syncTemplates = useSyncTemplates();
  const deleteTemplate = useDeleteTemplate();

  const templates = data?.data?.templates ?? [];
  const meta = data?.meta;

  const setBusy = (value: string | null) => {
    setRowBusyKey(value);
  };

  const openPublishDialog = (template: Template) => {
    setPublishTarget(template);
    setDialogWabaId(template.waba_id || '');
  };

  const openGlobalSyncDialog = () => {
    setDialogWabaId('');
    setSyncOpen(true);
  };

  const handleSync = useCallback(async (wabaId: string, scopeKey: string) => {
    setBusy(scopeKey);
    try {
      const result = await syncTemplates.mutateAsync(wabaId);
      toast.success(
        `Synced ${result.synced} templates (${result.created} created, ${result.updated} updated).`
      );
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to sync templates.';
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }, [syncTemplates]);

  const handlePublish = async () => {
    if (!publishTarget) {
      return;
    }

    const wabaId = dialogWabaId.trim() || publishTarget.waba_id || undefined;
    if (!wabaId) {
      toast.error('Choose a WABA before submitting this template to Meta.');
      return;
    }

    setBusy(`publish:${publishTarget.id}`);
    try {
      await publishTemplate.mutateAsync({ id: publishTarget.id, waba_id: wabaId });
      toast.success('Template submitted to Meta for review.');
      setPublishTarget(null);
      setDialogWabaId('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to submit template.';
      toast.error(message);
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
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete template.';
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setTypeFilter('');
    setWabaFilter('');
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
            <div className="min-w-[220px]">
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
              {template.meta_template_id ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Meta ID: {template.meta_template_id}
                </div>
              ) : null}
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
              <div className="text-xs text-muted-foreground">
                {TEMPLATE_TYPE_LABELS[template.type]}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'waba_id',
        header: 'WABA ID',
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? (
            <span className="font-mono text-xs">{value}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Not assigned</span>
          );
        },
      },
      {
        accessorKey: 'language',
        header: 'Language',
        cell: ({ getValue }) => (
          <div className="min-w-[130px] text-sm">{getTemplateLanguageLabel(getValue() as string)}</div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue() as Template['status'];
          return (
            <Badge
              variant="outline"
              className={TEMPLATE_STATUS_CLASSES[status]}
            >
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
          const actions = getTemplateAvailableActions(template);
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
                      onSelect={(event) => {
                        event.preventDefault();
                        if (template.waba_id) {
                          void handleSync(template.waba_id, `sync:${template.id}`);
                        }
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
    [handleSync, navigate, rowBusyKey]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-gradient-to-r from-[#0f766e] via-[#115e59] to-[#134e4a] text-white shadow-lg">
        <CardHeader className="border-none pb-0">
          <CardTitle className="text-2xl">WhatsApp Templates</CardTitle>
          <CardDescription className="text-emerald-50/80">
            Manage template inventory across multiple WABAs with safe status-aware actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/70">Templates</div>
              <div className="mt-1 text-2xl font-semibold">{meta?.total ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/70">Connected WABAs</div>
              <div className="mt-1 text-2xl font-semibold">{wabaOptions.length}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/70">Visible Rows</div>
              <div className="mt-1 text-2xl font-semibold">{templates.length}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={openGlobalSyncDialog}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync from Meta
            </Button>
            <Button className="bg-white text-emerald-900 hover:bg-emerald-50" onClick={() => navigate('/templates/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Filter templates</CardTitle>
            <CardDescription>
              Narrow by status, type, category, language, and WABA assignment before you take action.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_auto]">
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
          <TemplateOptionSelect
            value={wabaFilter || null}
            options={wabaOptions}
            placeholder="Filter by WABA ID"
            searchPlaceholder="Search WABA by verified name, phone, or ID"
            emptyMessage="No connected WABAs found."
            onChange={(value) => {
              setWabaFilter(value);
              setPage(1);
            }}
          />
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

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sync templates from Meta</DialogTitle>
            <DialogDescription>
              Pull the latest template catalogue for one WhatsApp Business Account into Nyife.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TemplateOptionSelect
              value={dialogWabaId || null}
              options={wabaOptions}
              placeholder="Select a connected WABA"
              searchPlaceholder="Search connected WABAs"
              emptyMessage="No connected WABAs available."
              onChange={setDialogWabaId}
            />
            <p className="text-xs text-muted-foreground">
              Sync is scoped per WABA. Existing local rows will be updated when Meta returns the same template name and language.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!dialogWabaId) {
                  toast.error('Choose a WABA to sync.');
                  return;
                }
                await handleSync(dialogWabaId, 'sync:dialog');
                setSyncOpen(false);
                setDialogWabaId('');
              }}
              disabled={syncTemplates.isPending}
            >
              {syncTemplates.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync WABA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!publishTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPublishTarget(null);
            setDialogWabaId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit template to Meta</DialogTitle>
            <DialogDescription>
              Only draft or rejected templates can be resubmitted. Pick the WABA that owns this template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="font-semibold">
                {publishTarget?.display_name || publishTarget?.name}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {publishTarget ? TEMPLATE_TYPE_LABELS[publishTarget.type] : ''} template
              </div>
            </div>
            <TemplateOptionSelect
              value={dialogWabaId || null}
              options={wabaOptions}
              placeholder="Select the WABA used for this template"
              searchPlaceholder="Search connected WABAs"
              emptyMessage="No connected WABAs available."
              onChange={setDialogWabaId}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPublishTarget(null);
                setDialogWabaId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishTemplate.isPending}>
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
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
