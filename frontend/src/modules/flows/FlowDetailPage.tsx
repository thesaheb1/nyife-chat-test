import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Copy, Pencil, Send, Trash2 } from 'lucide-react';
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
import { FlowDetailOverview } from './FlowDetailOverview';
import { FlowPreviewDialog } from './FlowPreviewDialog';
import { getFlowAvailableActions } from './flowLifecycle';
import { isFlowPreviewExpired } from './flowPreview';
import { deriveBuilderStateFromMetaFlow, formatValidationDetail } from './flowUtils';
import {
  useDeleteFlow,
  useDeprecateFlow,
  useDuplicateFlow,
  useFlow,
  useFlowSubmissions,
  usePublishFlow,
  useRefreshFlowPreview,
} from './useFlows';

type ConfirmAction = 'publish' | 'delete' | 'deprecate' | null;

export function FlowDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { canOrganization } = usePermissions();
  const { data: flow, isLoading } = useFlow(id);
  const publishFlow = usePublishFlow();
  const deleteFlow = useDeleteFlow();
  const deprecateFlow = useDeprecateFlow();
  const duplicateFlow = useDuplicateFlow();
  const refreshPreview = useRefreshFlowPreview();
  const [submissionPage, setSubmissionPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const { data: submissionsData, isLoading: submissionsLoading } = useFlowSubmissions(id, { page: submissionPage, limit: 10 });
  const canCreateFlows = canOrganization('flows', 'create');
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

  const availableActions = getFlowAvailableActions(flow);
  const validationItems = (flow.validation_error_details || []).map((detail) => formatValidationDetail(detail));
  const mergedValidationItems = Array.from(new Set([
    ...validationItems,
    ...flow.validation_errors,
  ]));
  const previewExpired = isFlowPreviewExpired(flow.preview_expires_at);
  const previewState = deriveBuilderStateFromMetaFlow(flow.json_definition);
  const canEdit = canUpdateFlows && availableActions.includes('edit');
  const canPublish = canUpdateFlows && availableActions.includes('publish');
  const canClone = canCreateFlows && availableActions.includes('clone');
  const canDeprecate = canUpdateFlows && availableActions.includes('deprecate');
  const canDelete = canDeleteFlows && availableActions.includes('delete');

  const confirmDescription = confirmAction === 'publish'
    ? 'Nyife will publish the current draft to Meta using the stored canonical JSON definition.'
    : confirmAction === 'deprecate'
      ? 'Deprecation applies to active published-like flows and prevents them from remaining in service.'
      : 'Only draft flows can be deleted. If this draft is linked to a Meta draft, Nyife will delete that Meta draft first before removing the local record.';

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
                  Review the linked Meta state, open the reusable preview dialog, inspect stored validation details, and verify captured submissions from one compact surface.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button onClick={() => navigate(`/flows/${flow.id}/edit`)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit flow
                </Button>
              ) : null}
              {canClone ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const duplicate = await duplicateFlow.mutateAsync(flow.id);
                      toast.success('Flow cloned successfully.');
                      navigate(`/flows/${duplicate.id}/edit`);
                    } catch (error) {
                      toast.error(getApiErrorMessage(error, 'Failed to clone flow.'));
                    }
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Clone
                </Button>
              ) : null}
              {canDeprecate ? (
                <Button variant="outline" onClick={() => setConfirmAction('deprecate')}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Deprecate
                </Button>
              ) : null}
              {canPublish ? (
                <Button variant="outline" onClick={() => setConfirmAction('publish')}>
                  <Send className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              ) : null}
              {canDelete ? (
                <Button variant="outline" onClick={() => setConfirmAction('delete')}>
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
          onOpenPreview={() => setPreviewDialogOpen(true)}
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

      <FlowPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        title={flow.name}
        definition={previewState.definition}
        builderSupported={previewState.supported}
        warning={previewState.warning}
        metaFlowId={flow.meta_flow_id}
        previewUrl={flow.preview_url}
        previewExpiresAt={flow.preview_expires_at}
        onRefreshOfficialPreview={flow.meta_flow_id
          ? (force) => refreshPreview.mutateAsync({ id: flow.id, force })
          : undefined}
      />

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'publish'
                ? 'Publish this flow?'
                : confirmAction === 'deprecate'
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
              variant={confirmAction === 'delete' ? 'destructive' : 'default'}
              onClick={async (event) => {
                event.preventDefault();
                const currentAction = confirmAction;
                setConfirmAction(null);

                try {
                  if (currentAction === 'publish') {
                    await publishFlow.mutateAsync({ id: flow.id });
                    toast.success('Flow published successfully.');
                    return;
                  }

                  if (currentAction === 'deprecate') {
                    await deprecateFlow.mutateAsync(flow.id);
                    toast.success('Flow deprecated successfully.');
                    return;
                  }

                  await deleteFlow.mutateAsync(flow.id);
                  toast.success('Flow deleted successfully.');
                  navigate('/flows');
                } catch (error) {
                  toast.error(
                    getApiErrorMessage(
                      error,
                      currentAction === 'publish'
                        ? 'Failed to publish flow.'
                        : currentAction === 'deprecate'
                          ? 'Failed to deprecate flow.'
                          : 'Failed to delete flow.'
                    )
                  );
                }
              }}
            >
              {confirmAction === 'publish'
                ? 'Publish'
                : confirmAction === 'deprecate'
                  ? 'Deprecate'
                  : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FlowDetailPage;
