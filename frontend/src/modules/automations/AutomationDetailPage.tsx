import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Pencil } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { useAutomation, useAutomationLogs, useUpdateAutomationStatus, useDeleteAutomation } from './useAutomations';
import type { AutomationLog } from '@/core/types';

export function AutomationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: automation, isLoading } = useAutomation(id);
  const [logPage, setLogPage] = useState(1);
  const { data: logsData, isLoading: logsLoading } = useAutomationLogs(id, logPage);
  const updateStatus = useUpdateAutomationStatus();
  const deleteAuto = useDeleteAutomation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteAuto.mutateAsync(id);
      toast.success('Automation deleted');
      navigate('/automations');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete automation.'));
    }
  };

  const logColumns = useMemo<ColumnDef<AutomationLog, unknown>[]>(() => [
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <Badge variant="secondary" className={`text-xs ${s === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s}</Badge>;
      },
    },
    { accessorKey: 'contact_phone', header: 'Contact', cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || '—'}</span> },
    { accessorKey: 'error_message', header: 'Error', cell: ({ getValue }) => <span className="text-xs text-destructive">{(getValue() as string) || '—'}</span> },
    { accessorKey: 'created_at', header: 'Time', cell: ({ getValue }) => new Date(getValue() as string).toLocaleString() },
  ], []);

  if (isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48" /></div>;
  if (!automation) return <div className="py-12 text-center text-muted-foreground">Automation not found.</div>;

  const stats = automation.stats as { triggered_count?: number; last_triggered_at?: string } | null;
  const logs = logsData?.data?.logs ?? [];
  const logMeta = logsData?.meta;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{automation.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">{automation.type.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Active</Label>
          <Switch
            checked={automation.status === 'active'}
            onCheckedChange={() => {
              const s = automation.status === 'active' ? 'inactive' : 'active';
              updateStatus.mutate({ id: automation.id, status: s }, { onSuccess: () => toast.success(`Automation ${s}`) });
            }}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/automations/${id}/edit`)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Status</p><p className="text-lg font-semibold capitalize">{automation.status}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Times Triggered</p><p className="text-lg font-semibold tabular-nums">{stats?.triggered_count ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xs text-muted-foreground">Last Triggered</p><p className="text-sm">{stats?.last_triggered_at ? new Date(stats.last_triggered_at).toLocaleString() : 'Never'}</p></CardContent></Card>
      </div>

      {automation.description && (
        <Card><CardHeader><CardTitle className="text-lg">Description</CardTitle></CardHeader><CardContent><p className="text-sm">{automation.description}</p></CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-lg">Trigger Config</CardTitle></CardHeader><CardContent><pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(automation.trigger_config, null, 2)}</pre></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Action Config</CardTitle></CardHeader><CardContent><pre className="overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(automation.action_config, null, 2)}</pre></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Execution Logs</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={logColumns} data={logs} isLoading={logsLoading} page={logMeta?.page ?? 1} totalPages={logMeta?.totalPages ?? 1} total={logMeta?.total} onPageChange={setLogPage} emptyMessage="No logs yet." />
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete automation?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{automation.name}".</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
