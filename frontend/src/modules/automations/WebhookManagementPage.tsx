import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Beaker, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
import { DataTable } from '@/shared/components/DataTable';
import type { Webhook } from '@/core/types';
import { useCreateWebhook, useDeleteWebhook, useTestWebhook, useUpdateWebhook, useWebhooks } from './useWebhooks';

const AVAILABLE_EVENTS = [
  {
    id: 'message.received',
    label: 'Inbound message',
    description: 'Fire when any connected WhatsApp number receives a message.',
  },
  {
    id: 'automation.triggered',
    label: 'Automation success',
    description: 'Fire after an automation executes successfully.',
  },
  {
    id: 'automation.failed',
    label: 'Automation failure',
    description: 'Fire when an automation action errors.',
  },
] as const;

type WebhookFormState = {
  name: string;
  url: string;
  secret: string;
  headersText: string;
  events: string[];
  is_active: boolean;
};

function createEmptyForm(): WebhookFormState {
  return {
    name: '',
    url: '',
    secret: '',
    headersText: '{\n  \n}',
    events: ['message.received'],
    is_active: true,
  };
}

function buildFormState(webhook: Webhook): WebhookFormState {
  return {
    name: webhook.name,
    url: webhook.url,
    secret: webhook.secret || '',
    headersText: JSON.stringify(webhook.headers || {}, null, 2),
    events: webhook.events || [],
    is_active: webhook.is_active,
  };
}

function parseHeaders(headersText: string) {
  const trimmed = headersText.trim();
  if (!trimmed || trimmed === '{' || trimmed === '{\n  \n}') {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object.');
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
  );
}

export function WebhookManagementPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [form, setForm] = useState<WebhookFormState>(createEmptyForm);

  const { data, isLoading } = useWebhooks({ page, limit: 20 });
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();

  const webhooks = data?.data.webhooks ?? [];
  const meta = data?.meta;

  const resetForm = () => {
    setEditingWebhook(null);
    setForm(createEmptyForm());
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setForm(buildFormState(webhook));
    setDialogOpen(true);
  };

  const toggleEvent = (eventId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      events: checked
        ? Array.from(new Set([...current.events, eventId]))
        : current.events.filter((event) => event !== eventId),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('Name and URL are required.');
      return;
    }

    if (form.events.length === 0) {
      toast.error('Select at least one event.');
      return;
    }

    let headers: Record<string, string> | undefined;
    try {
      headers = parseHeaders(form.headersText);
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }

    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      events: form.events,
      secret: form.secret.trim() || undefined,
      headers,
      is_active: form.is_active,
    };

    try {
      if (editingWebhook) {
        await updateWebhook.mutateAsync({ id: editingWebhook.id, ...payload });
        toast.success('Webhook updated.');
      } else {
        await createWebhook.mutateAsync(payload);
        toast.success('Webhook created.');
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save webhook.';
      toast.error(message);
    }
  };

  const handleTest = async (webhook: Webhook) => {
    try {
      await testWebhook.mutateAsync(webhook.id);
      toast.success(`Test webhook sent to ${webhook.url}.`);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Webhook test failed.';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteWebhook.mutateAsync(deleteTarget.id);
      toast.success('Webhook deleted.');
      setDeleteTarget(null);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to delete webhook.';
      toast.error(message);
    }
  };

  const columns: ColumnDef<Webhook, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.url}</p>
        </div>
      ),
    },
    {
      accessorKey: 'events',
      header: 'Events',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.events.map((event) => (
            <Badge key={event} variant="outline" className="text-[10px]">
              {event}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'secondary' : 'outline'}>
          {row.original.is_active ? 'Active' : 'Paused'}
        </Badge>
      ),
    },
    {
      accessorKey: 'last_triggered_at',
      header: 'Last Delivery',
      cell: ({ row }) =>
        row.original.last_triggered_at
          ? new Date(row.original.last_triggered_at).toLocaleString()
          : 'Never',
    },
    {
      accessorKey: 'failure_count',
      header: 'Failures',
      cell: ({ row }) => row.original.failure_count,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => handleTest(row.original)}>
            <Beaker className="mr-2 h-3.5 w-3.5" />
            Test
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(row.original)}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(row.original)}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const isSaving = createWebhook.isPending || updateWebhook.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Automation Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Receive tenant-scoped inbound message and automation lifecycle events on your own endpoints.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Event Catalog</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {AVAILABLE_EVENTS.map((event) => (
            <div key={event.id} className="rounded-lg border p-4">
              <p className="font-medium">{event.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.id}</p>
              <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={webhooks}
        isLoading={isLoading}
        page={meta?.page ?? 1}
        totalPages={meta?.totalPages ?? 1}
        total={meta?.total}
        onPageChange={setPage}
        emptyMessage="No automation webhooks yet. Create one to push events into your own systems."
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="CRM webhook"
                />
              </div>
              <div className="space-y-2">
                <Label>Delivery URL</Label>
                <Input
                  value={form.url}
                  onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://example.com/webhooks/nyife"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>Signing Secret</Label>
                <Input
                  value={form.secret}
                  onChange={(event) => setForm((current) => ({ ...current, secret: event.target.value }))}
                  placeholder="Optional HMAC secret"
                />
                <p className="text-xs text-muted-foreground">
                  If set, Nyife signs each request with `x-webhook-signature` using HMAC SHA-256.
                </p>
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-2">
                  <Label>Enabled</Label>
                  <div className="flex h-10 items-center">
                    <Switch
                      checked={form.is_active}
                      onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Events</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {AVAILABLE_EVENTS.map((event) => (
                  <label key={event.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={form.events.includes(event.id)}
                        onCheckedChange={(checked) => toggleEvent(event.id, Boolean(checked))}
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom Headers (JSON object)</Label>
              <Textarea
                value={form.headersText}
                onChange={(event) => setForm((current) => ({ ...current, headersText: event.target.value }))}
                rows={8}
                className="font-mono text-xs"
                placeholder='{"x-api-key":"secret"}'
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingWebhook ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This removes ${deleteTarget.name} and stops future deliveries.`
                : 'This removes the webhook and stops future deliveries.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
