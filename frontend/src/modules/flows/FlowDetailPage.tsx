import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { usePermissions } from '@/core/hooks/usePermissions';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { DataTable } from '@/shared/components/DataTable';
import type { FlowSubmission } from '@/core/types';
import { buildFlowPreviewPath, isFlowPreviewExpired } from './flowPreview';
import { FlowDetailOverview } from './FlowDetailOverview';
import { formatValidationDetail } from './flowUtils';
import { useDeleteFlow, useFlow, useFlowSubmissions, useRefreshFlowPreview } from './useFlows';

export function FlowDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { canOrganization } = usePermissions();
  const { data: flow, isLoading } = useFlow(id);
  const deleteFlow = useDeleteFlow();
  const refreshPreview = useRefreshFlowPreview();
  const [submissionPage, setSubmissionPage] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { data: submissionsData, isLoading: submissionsLoading } = useFlowSubmissions(id, { page: submissionPage, limit: 10 });
  const canUpdateFlows = canOrganization('flows', 'update');
  const canDeleteFlows = canOrganization('flows', 'delete');

  const columns = useMemo<ColumnDef<FlowSubmission, unknown>[]>(() => [
    {
      accessorKey: 'contact_phone',
      header: 'Contact',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.contact_phone}</p>
          <p className="text-xs text-muted-foreground">{row.original.flow_token || 'No flow token'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'screen_id',
      header: 'Screen',
      cell: ({ row }) => row.original.screen_id || '-',
    },
    {
      accessorKey: 'automation_status',
      header: 'Automation',
      cell: ({ row }) => <Badge variant="outline">{row.original.automation_status}</Badge>,
    },
    {
      accessorKey: 'created_at',
      header: 'Submitted',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
  ], []);

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading flow...</div>;
  }

  if (!flow) {
    return <div className="py-12 text-center text-muted-foreground">Flow not found.</div>;
  }

  const validationItems = (flow.validation_error_details || []).map((detail) => formatValidationDetail(detail));
  const mergedValidationItems = Array.from(new Set([
    ...validationItems,
    ...flow.validation_errors,
  ]));
  const previewExpired = isFlowPreviewExpired(flow.preview_expires_at);

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-3xl border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/flows')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{flow.name}</h1>
                  <Badge variant="outline">{flow.status}</Badge>
                  {flow.meta_status && flow.meta_status !== flow.status ? <Badge variant="secondary">{flow.meta_status}</Badge> : null}
                  {flow.has_local_changes ? <Badge variant="secondary">Local changes</Badge> : null}
                  {flow.can_send_message === false ? <Badge variant="destructive">Send blocked</Badge> : null}
                </div>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  Review the linked Meta state, refresh the official preview when it expires, inspect stored validation details, and verify captured submissions from one compact surface.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canUpdateFlows ? (
                <Button onClick={() => navigate(`/flows/${flow.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit flow
                </Button>
              ) : null}
              {canDeleteFlows ? (
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <FlowDetailOverview
          flow={flow}
          previewExpired={previewExpired}
          isRefreshingPreview={refreshPreview.isPending}
          onOpenPreviewWorkspace={() => navigate(buildFlowPreviewPath({ source: 'detail', flowId: flow.id }))}
          onOpenOfficialPreview={() => {
            if (flow.preview_url) {
              window.open(flow.preview_url, '_blank', 'noopener,noreferrer');
            }
          }}
          onRefreshOfficialPreview={async () => {
            try {
              await refreshPreview.mutateAsync({ id: flow.id, force: true });
              toast.success('Official Meta preview refreshed.');
            } catch (error) {
              toast.error(getApiErrorMessage(error, 'Failed to refresh official preview.'));
            }
          }}
        />

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="health">Meta health</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Submissions</CardTitle>
                <CardDescription>Inbound WhatsApp Flow completions captured for this organization and flow.</CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={submissionsData?.submissions || []}
                  isLoading={submissionsLoading}
                  page={submissionsData?.meta.page ?? submissionPage}
                  totalPages={submissionsData?.meta.totalPages ?? 1}
                  total={submissionsData?.meta.total ?? 0}
                  onPageChange={setSubmissionPage}
                  emptyMessage="No submissions captured yet."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Validation</CardTitle>
                <CardDescription>Stored local or Meta validation issues, including line and column detail when Meta provides it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {mergedValidationItems.length === 0 ? (
                  <p className="text-muted-foreground">No validation issues recorded.</p>
                ) : (
                  mergedValidationItems.map((issue) => <p key={issue}>- {issue}</p>)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Meta health</CardTitle>
                <CardDescription>Raw Meta status and health payload captured during sync, save, publish, or preview refresh.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="font-medium">Meta status:</span> {flow.meta_status || 'Unknown'}</p>
                <p><span className="font-medium">Can send message:</span> {flow.can_send_message == null ? 'Unknown' : flow.can_send_message ? 'Yes' : 'No'}</p>
                <pre className="overflow-auto rounded-2xl bg-muted p-4 text-xs">{JSON.stringify(flow.meta_health_status || {}, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle>Canonical Meta JSON</CardTitle>
                <CardDescription>The exact Meta-compatible JSON definition currently stored in Nyife.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-2xl bg-muted p-4 text-xs">{JSON.stringify(flow.json_definition, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flow?</AlertDialogTitle>
            <AlertDialogDescription>
              Draft deletion is permanent. If this flow is linked to a Meta draft, Nyife will delete that Meta draft first before removing the local record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (!id) {
                  return;
                }

                setDeleteConfirmOpen(false);
                deleteFlow.mutate(id, {
                  onSuccess: () => {
                    toast.success('Flow deleted successfully.');
                    navigate('/flows');
                  },
                  onError: (error) => {
                    toast.error(getApiErrorMessage(error, 'Failed to delete flow.'));
                  },
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FlowDetailPage;
