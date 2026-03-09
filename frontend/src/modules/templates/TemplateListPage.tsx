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
import { useDebounce } from '@/core/hooks';
import type { Template } from '@/core/types';
import { DataTable } from '@/shared/components/DataTable';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { TemplateOptionSelect } from './TemplateOptionSelect';
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
import { buildTemplateWabaOptions, findTemplateWabaOption } from './wabaOptions';

function getScopedWabaOptions(
  template: Template | null,
  wabaOptions: ReturnType<typeof buildTemplateWabaOptions>
) {
  if (!template?.waba_id) {
    return wabaOptions;
  }

  return wabaOptions.filter((option) => option.waba_id === template.waba_id);
}

function getDefaultWabaId(
  template: Template | null,
  wabaOptions: ReturnType<typeof buildTemplateWabaOptions>
) {
  return (
    findTemplateWabaOption(getScopedWabaOptions(template, wabaOptions), {
      wabaId: template?.waba_id,
      waAccountId: template?.wa_account_id,
    })?.value || getScopedWabaOptions(template, wabaOptions)[0]?.value || ''
  );
}

export function TemplateListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [wabaFilterId, setWabaFilterId] = useState('');
  const [page, setPage] = useState(1);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncTarget, setSyncTarget] = useState<Template | null>(null);
  const [syncWabaId, setSyncWabaId] = useState('');
  const [publishTarget, setPublishTarget] = useState<Template | null>(null);
  const [publishWabaId, setPublishWabaId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [rowBusyKey, setRowBusyKey] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const { data: waAccounts } = useWhatsAppAccounts();
  const wabaOptions = useMemo(() => buildTemplateWabaOptions(waAccounts), [waAccounts]);
  const accountsById = useMemo(
    () => new Map((waAccounts || []).map((account) => [account.id, account])),
    [waAccounts]
  );
  const activeAccountCount = useMemo(
    () => (waAccounts || []).filter((account) => account.status === 'active').length,
    [waAccounts]
  );
  const connectedWabaCount = useMemo(
    () => wabaOptions.length,
    [wabaOptions]
  );
  const syncWabaOptions = useMemo(
    () => getScopedWabaOptions(syncTarget, wabaOptions),
    [syncTarget, wabaOptions]
  );
  const publishWabaOptions = useMemo(
    () => getScopedWabaOptions(publishTarget, wabaOptions),
    [publishTarget, wabaOptions]
  );

  const { data, isLoading } = useTemplates({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    type: typeFilter || undefined,
    waba_id: wabaFilterId || undefined,
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
    setPublishWabaId(getDefaultWabaId(template, wabaOptions));
  };

  const openGlobalSyncDialog = () => {
    setSyncTarget(null);
    setSyncWabaId('');
    setSyncOpen(true);
  };

  const openTemplateSyncDialog = (template: Template) => {
    setSyncTarget(template);
    setSyncWabaId(getDefaultWabaId(template, wabaOptions));
    setSyncOpen(true);
  };

  const handleSync = useCallback(async (wabaId: string, scopeKey: string) => {
    const option = findTemplateWabaOption(syncTarget ? syncWabaOptions : wabaOptions, { wabaId });
    if (!option) {
      toast.error('Choose an active WABA to sync.');
      return;
    }

    setBusy(scopeKey);
    try {
      const result = await syncTemplates.mutateAsync(option.wa_account_id);
      toast.success(`Synced ${result.synced} templates (${result.created} created, ${result.updated} updated).`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to sync templates.';
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }, [syncTarget, syncTemplates, syncWabaOptions, wabaOptions]);

  const handlePublish = async () => {
    if (!publishTarget) {
      return;
    }

    const option = findTemplateWabaOption(publishWabaOptions, { wabaId: publishWabaId });
    if (!option) {
      toast.error('Choose an active WABA before submitting this template to Meta.');
      return;
    }

    setBusy(`publish:${publishTarget.id}`);
    try {
      await publishTemplate.mutateAsync({ id: publishTarget.id, wa_account_id: option.wa_account_id });
      toast.success('Template submitted to Meta for review.');
      setPublishTarget(null);
      setPublishWabaId('');
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
    setWabaFilterId('');
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
          const account = template.wa_account_id ? accountsById.get(template.wa_account_id) : null;

          return (
            <div className="space-y-2">
              <Badge variant="outline">{template.category}</Badge>
              <div className="text-xs text-muted-foreground">{TEMPLATE_TYPE_LABELS[template.type]}</div>
              <div className="text-[11px] text-muted-foreground">
                {template.waba_id || 'WABA not assigned'}
              </div>
              {account?.verified_name ? (
                <div className="text-[11px] text-muted-foreground">{account.verified_name}</div>
              ) : null}
              {account && account.status !== 'active' ? (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {account.status}
                </Badge>
              ) : null}
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
                        openTemplateSyncDialog(template);
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
    [accountsById, navigate, rowBusyKey]
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none bg-gradient-to-r from-[#0f766e] via-[#115e59] to-[#134e4a] text-white shadow-lg">
        <CardHeader className="border-none pb-0">
          <CardTitle className="text-2xl">WhatsApp Templates</CardTitle>
          <CardDescription className="text-emerald-50/80">
            Manage template inventory across multiple connected WABAs while preserving shared Meta scope underneath.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/70">Templates</div>
              <div className="mt-1 text-2xl font-semibold">{meta?.total ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/70">Active accounts</div>
              <div className="mt-1 text-2xl font-semibold">{activeAccountCount}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-50/70">Connected WABAs</div>
              <div className="mt-1 text-2xl font-semibold">{connectedWabaCount}</div>
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
              Narrow by status, type, category, and WABA. Template rows stay grouped by WABA underneath.
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
            value={wabaFilterId || null}
            options={wabaOptions}
            placeholder="Filter by WABA"
            searchPlaceholder="Search connected WABAs"
            emptyMessage="No active WhatsApp WABAs found."
            onChange={(value) => {
              setWabaFilterId(value);
              setPage(1);
            }}
            disabled={wabaOptions.length === 0}
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

      <Dialog
        open={syncOpen}
        onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) {
            setSyncTarget(null);
            setSyncWabaId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sync templates from Meta</DialogTitle>
            <DialogDescription>
              {syncTarget
                ? 'Choose the WABA used to sync this template from Meta.'
                : 'Pull the latest template catalogue for one connected WABA into Nyife.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TemplateOptionSelect
              value={syncWabaId || null}
              options={syncWabaOptions}
              placeholder="Select a connected WABA"
              searchPlaceholder="Search connected WABAs"
              emptyMessage="No active WhatsApp WABAs match this template."
              onChange={setSyncWabaId}
              disabled={syncWabaOptions.length === 0}
            />
            <p className="text-xs text-muted-foreground">
              Sync is still WABA-scoped underneath. Existing local rows are updated when Meta returns the same template name and language.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!syncWabaId) {
                  toast.error('Choose an active WABA to sync.');
                  return;
                }
                await handleSync(syncWabaId, syncTarget ? `sync:${syncTarget.id}` : 'sync:dialog');
                setSyncOpen(false);
                setSyncTarget(null);
                setSyncWabaId('');
              }}
              disabled={syncTemplates.isPending || syncWabaOptions.length === 0}
            >
              {syncTemplates.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync templates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!publishTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPublishTarget(null);
            setPublishWabaId('');
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
              <div className="font-semibold">{publishTarget?.display_name || publishTarget?.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {publishTarget ? TEMPLATE_TYPE_LABELS[publishTarget.type] : ''} template
              </div>
            </div>
            <TemplateOptionSelect
              value={publishWabaId || null}
              options={publishWabaOptions}
              placeholder="Select the WABA used for this template"
              searchPlaceholder="Search connected WABAs"
              emptyMessage="No active WhatsApp WABAs match this template."
              onChange={setPublishWabaId}
              disabled={publishWabaOptions.length === 0}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPublishTarget(null);
                setPublishWabaId('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishTemplate.isPending || publishWabaOptions.length === 0}>
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
