import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  findWhatsAppAccount,
} from '@/modules/whatsapp/accountOptions';
import { useWhatsAppAccounts } from '@/modules/whatsapp/useWhatsAppAccounts';
import { TemplateOptionSelect } from './TemplateOptionSelect';
import { WhatsAppTemplatePreview } from './WhatsAppTemplatePreview';
import {
  TEMPLATE_STATUS_CLASSES,
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_TYPE_LABELS,
  getTemplateAvailableActions,
  getTemplateLanguageLabel,
} from './templateCatalog';
import { useDeleteTemplate, usePublishTemplate, useSyncTemplates, useTemplate } from './useTemplates';
import { buildTemplateWabaOptions, findTemplateWabaOption } from './wabaOptions';

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useTemplate(id);
  const { data: waAccounts } = useWhatsAppAccounts();
  const publishTemplate = usePublishTemplate();
  const syncTemplates = useSyncTemplates();
  const deleteTemplate = useDeleteTemplate();

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishWabaId, setPublishWabaId] = useState('');
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncWabaId, setSyncWabaId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const wabaOptions = useMemo(() => buildTemplateWabaOptions(waAccounts), [waAccounts]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-72" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Skeleton className="h-[780px] w-full rounded-3xl" />
          <Skeleton className="h-[620px] w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!template) {
    return <div className="py-12 text-center text-muted-foreground">Template not found.</div>;
  }

  const actions = getTemplateAvailableActions(template);
  const currentAccount = findWhatsAppAccount(waAccounts, template.wa_account_id);
  const scopedWabaOptions = template.waba_id
    ? wabaOptions.filter((option) => option.waba_id === template.waba_id)
    : wabaOptions;
  const defaultWabaId =
    findTemplateWabaOption(scopedWabaOptions, {
      wabaId: template.waba_id,
      waAccountId: template.wa_account_id,
    })?.value || scopedWabaOptions[0]?.value || '';

  const handlePublish = async () => {
    const selectedOption = findTemplateWabaOption(scopedWabaOptions, { wabaId: publishWabaId });

    if (!selectedOption) {
      toast.error('Choose an active WABA before submitting this template to Meta.');
      return;
    }

    try {
      await publishTemplate.mutateAsync({ id: template.id, wa_account_id: selectedOption.wa_account_id });
      toast.success('Template submitted to Meta for review.');
      setPublishOpen(false);
      setPublishWabaId('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to submit template.';
      toast.error(message);
    }
  };

  const handleSync = async () => {
    const selectedOption = findTemplateWabaOption(scopedWabaOptions, { wabaId: syncWabaId });

    if (!selectedOption) {
      toast.error('Choose an active WABA to sync this template.');
      return;
    }

    try {
      const result = await syncTemplates.mutateAsync(selectedOption.wa_account_id);
      toast.success(`Synced ${result.synced} templates (${result.created} created, ${result.updated} updated).`);
      setSyncOpen(false);
      setSyncWabaId('');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to sync templates.';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success('Template deleted.');
      navigate('/templates');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete template.';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">
                {template.display_name || template.name}
              </h1>
              <Badge variant="outline" className={TEMPLATE_STATUS_CLASSES[template.status]}>
                {TEMPLATE_STATUS_LABELS[template.status]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {template.name} / {TEMPLATE_TYPE_LABELS[template.type]} / {getTemplateLanguageLabel(template.language)}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {actions.includes('edit') ? (
            <Button variant="outline" onClick={() => navigate(`/templates/${template.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
          {actions.includes('publish') ? (
            <Button
              onClick={() => {
                setPublishWabaId(defaultWabaId);
                setPublishOpen(true);
              }}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit to Meta
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="mr-2 h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Template actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate(`/templates/${template.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View details
              </DropdownMenuItem>
              {actions.includes('sync') ? (
                <DropdownMenuItem
                  onSelect={() => {
                    setSyncWabaId(defaultWabaId);
                    setSyncOpen(true);
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync WABA templates
                </DropdownMenuItem>
              ) : null}
              {actions.includes('delete') ? (
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete template
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList variant="line">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="components">Components JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Template details</CardTitle>
                <CardDescription>All metadata required for review, routing, and account-selected WABA usage.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Category</div>
                  <div className="mt-2 font-semibold">{template.category}</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Type</div>
                  <div className="mt-2 font-semibold">{TEMPLATE_TYPE_LABELS[template.type]}</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Language</div>
                  <div className="mt-2 font-semibold">{getTemplateLanguageLabel(template.language)}</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last synced</div>
                  <div className="mt-2 font-semibold">
                    {template.last_synced_at ? new Date(template.last_synced_at).toLocaleString() : 'Not synced'}
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Created</div>
                  <div className="mt-2 font-semibold">{new Date(template.created_at).toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Updated</div>
                  <div className="mt-2 font-semibold">{new Date(template.updated_at).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>

            {template.rejection_reason ? (
              <Card className="mt-6 border-rose-200 dark:border-rose-900">
                <CardHeader>
                  <CardTitle>Rejection reason</CardTitle>
                  <CardDescription>Meta returned this feedback during the last review cycle.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{template.rejection_reason}</CardContent>
              </Card>
            ) : null}
          </TabsContent>
          <TabsContent value="components">
            <Card>
              <CardHeader>
                <CardTitle>Components JSON</CardTitle>
                <CardDescription>Exact component payload stored for this template.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-2xl bg-muted p-4 text-xs">
                  {JSON.stringify(template.components, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <WhatsAppTemplatePreview
            templateName={template.display_name || template.name}
            type={template.type}
            components={template.components}
          />
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>
              <CardDescription>Track the Meta state and connected WABA currently linked to this template.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={TEMPLATE_STATUS_CLASSES[template.status]}>
                  {TEMPLATE_STATUS_LABELS[template.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Connected WABA</span>
                <div className="text-right">
                  <div className="text-xs font-medium">
                    {template.waba_id || 'Not assigned'}
                  </div>
                  {currentAccount ? (
                    <div className="text-[11px] text-muted-foreground">
                      {currentAccount.verified_name || 'Linked through a connected active account'}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account status</span>
                <Badge variant="outline">
                  {currentAccount?.status || 'disconnected'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WABA ID</span>
                <span className="font-mono text-xs">{template.waba_id || 'Not assigned'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Meta template ID</span>
                <span className="font-mono text-xs">{template.meta_template_id || 'Not synced yet'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          setPublishOpen(open);
          if (!open) {
            setPublishWabaId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit template to Meta</DialogTitle>
            <DialogDescription>Select the WABA that should own this template in Meta review.</DialogDescription>
          </DialogHeader>
          <TemplateOptionSelect
            value={publishWabaId || null}
            options={scopedWabaOptions}
            placeholder="Select connected WABA"
            searchPlaceholder="Search connected WABAs"
            emptyMessage="No active WhatsApp WABAs match this template."
            onChange={setPublishWabaId}
            disabled={scopedWabaOptions.length === 0}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button onClick={handlePublish} disabled={publishTemplate.isPending || scopedWabaOptions.length === 0}>
              {publishTemplate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit to Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={syncOpen}
        onOpenChange={(open) => {
          setSyncOpen(open);
          if (!open) {
            setSyncWabaId('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Sync templates from Meta</DialogTitle>
            <DialogDescription>Select the WABA to use for this template's Meta sync.</DialogDescription>
          </DialogHeader>
          <TemplateOptionSelect
            value={syncWabaId || null}
            options={scopedWabaOptions}
            placeholder="Select connected WABA"
            searchPlaceholder="Search connected WABAs"
            emptyMessage="No active WhatsApp WABAs match this template."
            onChange={setSyncWabaId}
            disabled={scopedWabaOptions.length === 0}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)}>Cancel</Button>
            <Button onClick={handleSync} disabled={syncTemplates.isPending || scopedWabaOptions.length === 0}>
              {syncTemplates.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync templates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {template.display_name || template.name} will be removed from Nyife, and the backend will attempt the matching Meta cleanup where supported.
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
