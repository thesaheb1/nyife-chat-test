import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react';
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
import { WhatsAppFlowPreview } from './WhatsAppFlowPreview';
import {
  deriveBuilderStateFromMetaFlow,
  formatValidationDetail,
  humanizeFlowCategory,
} from './flowUtils';
import { useDeleteFlow, useFlow, useFlowSubmissions } from './useFlows';
import type { FlowSubmission } from '@/core/types';

export function FlowDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { canOrganization } = usePermissions();
  const { data: flow, isLoading } = useFlow(id);
  const deleteFlow = useDeleteFlow();
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

  const builderState = deriveBuilderStateFromMetaFlow(flow.json_definition);
  const validationItems = (flow.validation_error_details || []).map((detail) => formatValidationDetail(detail));
  const mergedValidationItems = Array.from(new Set([
    ...validationItems,
    ...flow.validation_errors,
  ]));

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/flows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{flow.name}</h1>
              <Badge variant="outline">{flow.status}</Badge>
              {flow.meta_status && flow.meta_status !== flow.status ? <Badge variant="secondary">{flow.meta_status}</Badge> : null}
              {flow.has_local_changes ? <Badge variant="secondary">Local changes</Badge> : null}
              {flow.can_send_message === false ? <Badge variant="destructive">Send blocked</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Inspect the linked Meta state, run an in-app flow preview, review validation detail, and verify captured submissions.
            </p>
          </div>
          <div className="flex gap-2">
            {flow.preview_url ? (
              <Button variant="outline" asChild>
                <a href={flow.preview_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Meta preview
                </a>
              </Button>
            ) : null}
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

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Flow overview</CardTitle>
              <CardDescription>Status, Meta linkage, categories, and validation health.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Metric label="Meta flow ID" value={flow.meta_flow_id || 'Not linked'} mono />
              <Metric label="JSON version" value={flow.json_version} />
              <Metric label="Screens" value={String(flow.json_definition.screens.length)} />
              <Metric label="Last synced" value={flow.last_synced_at ? new Date(flow.last_synced_at).toLocaleString() : 'Never'} />
              <Metric label="Categories" value={flow.categories.map(humanizeFlowCategory).join(', ')} />
              <Metric label="Sendability" value={flow.can_send_message === false ? 'Blocked' : flow.can_send_message === true ? 'Allowed' : 'Unknown'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Local preview</CardTitle>
              <CardDescription>
                {builderState.supported
                  ? 'Preview the supported static flow locally with field validation, navigation, and a WhatsApp-style shell.'
                  : 'This flow uses unsupported builder features and stays JSON-only for safety.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6">
              <WhatsAppFlowPreview
                definition={builderState.definition}
                builderSupported={builderState.supported}
                warning={builderState.warning || 'The in-app preview is unavailable because this flow uses unsupported Meta JSON features.'}
                className="mx-auto max-w-[28rem]"
              />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="health">Meta health</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions">
            <Card>
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
            <Card>
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
            <Card>
              <CardHeader>
                <CardTitle>Meta health</CardTitle>
                <CardDescription>Raw Meta status and health payload captured during sync, save, or publish.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p><span className="font-medium">Meta status:</span> {flow.meta_status || 'Unknown'}</p>
                <p><span className="font-medium">Can send message:</span> {flow.can_send_message === null || flow.can_send_message === undefined ? 'Unknown' : flow.can_send_message ? 'Yes' : 'No'}</p>
                <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(flow.meta_health_status || {}, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json">
            <Card>
              <CardHeader>
                <CardTitle>Canonical Meta JSON</CardTitle>
                <CardDescription>The exact Meta-compatible JSON definition currently stored in Nyife.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(flow.json_definition, null, 2)}</pre>
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

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? 'mt-2 break-all font-mono text-sm' : 'mt-2 text-sm font-medium'}>{value}</p>
    </div>
  );
}
